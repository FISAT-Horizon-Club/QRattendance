"use client";

// This page is a Client Component ("use client" above) because it needs
// things a Server Component cannot do: hold state, read from the camera, and
// talk to Supabase from the browser.
//
// ---------------------------------------------------------------------------
// READ THIS FIRST - what happens when you press a button
// ---------------------------------------------------------------------------
//
//   Press "Scan"
//     1. startScanner()  dynamically imports html5-qrcode and turns on the
//                        rear camera. The library injects a <video> into the
//                        <div id="qr-reader"> further down this file.
//     2. handleDecoded() fires the moment a QR is read. It stops the camera
//                        and calls findStudent().
//     3. findStudent()   turns the scanned text into a roll number, looks that
//                        roll number up in the `students` table, and puts the
//                        result in the `student` state. The details panel
//                        renders from that state.
//     4. handleUpdate()  runs when the teacher presses "Update attendance". It
//                        upserts a row into `attendance` and clears `student`.
//
// The only genuinely fiddly part is step 1, because html5-qrcode is an old
// library that pokes at the DOM directly instead of using React. Every place
// that matters has a comment.
//
// To change what counts as a valid student, look at findStudent().
// To change the options in the status list, look at STATUS_OPTIONS above.

import { useEffect, useRef, useState } from "react";
import type { Html5Qrcode } from "html5-qrcode";
import { parseQrPayload } from "@/lib/qr-payload";
import { supabase } from "@/lib/supabase";

type AttendanceStatus = "present" | "absent" | "late";

// Only the columns the page actually shows. Listing them like this (instead of
// select("*")) keeps the response small and tells you what is available.
type Student = {
  id: string; // the uuid primary key - this is what attendance rows point at
  student_id: string; // the roll number typed on /create-qr, e.g. CSE2023001
  full_name: string;
  department: string | null; // null means nobody filled it in
};

// One small message box under the camera. "error", "success" and "info" are
// all styled the same for now - the words carry the meaning, not the colour.
// A good first improvement would be colouring them differently.
type Notice = { kind: "error" | "success" | "info"; text: string };

// Adding a status here (e.g. "on_duty") also means editing the `check` list on
// the `status` column in supabase/schema.sql, otherwise the database rejects it.
const STATUS_OPTIONS: { value: AttendanceStatus; label: string }[] = [
  { value: "present", label: "Present" },
  { value: "absent", label: "Absent" },
  { value: "late", label: "Late" },
];

// "en-CA" formats the date as YYYY-MM-DD, which is what a Postgres `date`
// column expects.
const today = new Date().toLocaleDateString("en-CA");

export default function ScannerPage() {
  // A ref, not state, because we need the html5-qrcode object itself and we
  // never want to trigger a re-render just to hold on to it. useRef gives us
  // one box that survives re-renders without React caring about its value.
  const scannerRef = useRef<Html5Qrcode | null>(null);

  // Also a ref, because this flag guards against a problem that is invisible
  // to React: one QR code triggers the decode callback many times a second.
  // useState would be too slow to catch it.
  const handlingRef = useRef(false);

  const [scanning, setScanning] = useState(false);
  const [student, setStudent] = useState<Student | null>(null);
  const [status, setStatus] = useState<AttendanceStatus>("present");
  const [notice, setNotice] = useState<Notice | null>(null);
  const [saving, setSaving] = useState(false);

  // Releasing the camera matters on phones: if you leave the stream running,
  // the little red recording light stays on and the browser can refuse to give
  // the camera to another app.
  async function stopScanner() {
    const scanner = scannerRef.current;
    scannerRef.current = null;

    if (scanner) {
      try {
        await scanner.stop();
      } catch {
        // The camera was already closed, so there is nothing to clean up.
      }
      // Removes the <video> the library added to the div, so the next scan
      // starts from a clean slate instead of stacking a second video.
      scanner.clear();
    }

    setScanning(false);
  }

  async function findStudent(decodedText: string) {
    // decodedText is whatever was inside the QR code. parseQrPayload pulls the
    // roll number out of it, so a QR holding a random URL fails to match anyone.
    const code = parseQrPayload(decodedText);

    if (!code) {
      setNotice({ kind: "error", text: "That QR code is empty. Try scanning again." });
      return;
    }

    // .eq() means "where student_id equals this". maybeSingle() expects zero or
    // one row, and gives us `data: null` instead of an error when nobody matches.
    const { data, error } = await supabase
      .from("students")
      .select("id, student_id, full_name, department")
      .eq("student_id", code)
      .maybeSingle();

    if (error) {
      // `error` means the query itself failed: no .env.local, table missing,
      // or the RLS policy blocked us. A missing student is the `!data` branch
      // below, which is a much more common and much less alarming case.
      setNotice({
        kind: "error",
        text: `Could not reach the database: ${error.message}`,
      });
      return;
    }

    if (!data) {
      setNotice({
        kind: "error",
        text: `No student found for "${code}". Create their QR first.`,
      });
      return;
    }

    setStudent(data);
    setStatus("present");
    setNotice({
      kind: "info",
      text: "Student found. Pick a status, then press Update.",
    });
  }

  async function handleDecoded(decodedText: string) {
    // The camera keeps the same QR code in view for many frames, so this fires
    // over and over. The flag makes sure only the first one does any work.
    if (handlingRef.current) return;
    handlingRef.current = true;

    // Stop the camera first, otherwise it happily reads the next student's QR
    // before the teacher has even looked at this one.
    await stopScanner();
    await findStudent(decodedText);

    handlingRef.current = false;
  }

  async function startScanner() {
    setNotice(null);
    setStudent(null);

    // Imported inside the function on purpose. html5-qrcode reaches for
    // browser-only APIs, and a plain top-level import would break while Next
    // renders this page on the server. A dynamic import loads it in the
    // browser only, and keeps it out of the bundle until you press Scan.
    const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import("html5-qrcode");

    // "qr-reader" is an id, not a ref, and that is html5-qrcode's design: it
    // finds the element by id and injects a <video> into it. The matching
    // id="qr-reader" div is in the JSX at the bottom of this file, and it must
    // stay in the DOM at all times or the library throws.
    const scanner = new Html5Qrcode("qr-reader", {
      // Only bother trying to read QR codes, not barcodes. The extra formats
      // would make scanning slower.
      formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
      verbose: false, // set true while debugging to see per-frame logs
    });
    scannerRef.current = scanner;
    setScanning(true);

    try {
      await scanner.start(
        // "environment" is the back camera, which is what you want for
        // scanning. Swapping to "user" gives the selfie camera instead.
        { facingMode: "environment" },
        {
          fps: 10, // how many frames to check per second
          aspectRatio: 1.777777778, // 16:9, the shape of the box below
          // The square region the library actually looks for codes in. Given as
          // a function so it shrinks on small screens; a hardcoded pixel size
          // can end up larger than the video and break scanning on a phone.
          qrbox: (viewfinderWidth, viewfinderHeight) => {
            const edge = Math.floor(Math.min(viewfinderWidth, viewfinderHeight) * 0.7);
            return { width: edge, height: edge };
          },
        },
        // Third argument: called with the QR text once a code is read.
        (decodedText) => {
          void handleDecoded(decodedText);
        },
        // Fourth argument: called for every frame that has no QR code in it.
        // That is most frames, so there is nothing to do and nothing to say.
        () => {}
      );
    } catch (error) {
      // The usual cause: the page is not on https or localhost, so the browser
      // refuses to hand over the camera.
      scannerRef.current = null;
      setScanning(false);
      setNotice({
        kind: "error",
        text: `Could not start the camera: ${
          error instanceof Error ? error.message : "unknown error"
        }. Browsers only allow camera access over HTTPS or on localhost.`,
      });
    }
  }

  async function handleUpdate() {
    // The Update button is disabled until a student is found, so this guard is
    // belt and braces.
    if (!student) return;

    setSaving(true);
    setNotice(null);

    // upsert = "insert, or update the row that is already there". The
    // onConflict names the columns the schema marks unique, so scanning the
    // same student twice in one day updates today's row instead of failing on
    // the unique constraint.
    //
    // Watch out: `student_id` on the attendance table is the student's uuid
    // (student.id), NOT their roll number (student.student_id). The two columns
    // share a name but mean different things.
    const { error } = await supabase
      .from("attendance")
      .upsert(
        { student_id: student.id, class_date: today, status },
        { onConflict: "student_id,class_date" }
      );

    setSaving(false);

    if (error) {
      setNotice({
        kind: "error",
        text: `Could not save attendance: ${error.message}`,
      });
      return;
    }

    setNotice({
      kind: "success",
      text: `Saved ${student.full_name} as ${status} for ${today}.`,
    });
    setStudent(null);
  }

  // If the teacher navigates away while the camera is on, the browser keeps
  // the camera light on unless we explicitly release it. The function returned
  // here is React's cleanup: it runs when the page unmounts.
  // The empty dependency array [] means "set nothing up, just clean up".
  useEffect(() => {
    return () => {
      const scanner = scannerRef.current;
      scannerRef.current = null;
      if (!scanner) return;

      scanner
        .stop()
        .catch(() => undefined)
        .then(() => {
          try {
            scanner.clear();
          } catch {
            // The element is already removed from the page.
          }
        });
    };
  }, []);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold text-neutral-900">Scan QR</h1>
        <p className="text-sm text-neutral-600">
          Scan a student&apos;s QR code, choose a status, then press Update to
          save it to the database.
        </p>
      </div>

      <div className="space-y-3">
        <div className="relative aspect-video w-full overflow-hidden rounded-md border border-neutral-300 bg-neutral-900">
          {/*
            The id below is the link between this JSX and html5-qrcode. The
            library looks up `qr-reader` by id and injects its <video> here.
            Do not give it a ref, do not move it into a conditional, and do not
            unmount it while the camera is on.

            The Tailwind classes style the injected <video> so it fills the box
            instead of showing at its own size.
          */}
          <div
            id="qr-reader"
            className="[&_video]:h-full [&_video]:w-full [&_video]:object-cover"
          />
          {!scanning && (
            <p className="absolute inset-0 flex items-center justify-center px-4 text-center text-sm text-neutral-400">
              Camera is off. Press Scan to start.
            </p>
          )}
        </div>

        {scanning ? (
          <button
            type="button"
            onClick={() => void stopScanner()}
            className="rounded-md border border-neutral-300 px-5 py-2 text-sm font-medium text-neutral-900 hover:bg-neutral-50"
          >
            Stop camera
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void startScanner()}
            className="rounded-md bg-neutral-900 px-5 py-2 text-sm font-medium text-white hover:bg-neutral-700"
          >
            Scan
          </button>
        )}

        {notice ? (
          <p className="rounded-md border border-dashed border-neutral-300 px-4 py-3 text-sm text-neutral-600">
            {notice.text}
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <h2 className="text-sm font-medium text-neutral-900">Student Details</h2>
        {student ? (
          <dl className="space-y-1 rounded-md border border-neutral-300 p-4 text-sm">
            <div className="flex gap-2">
              <dt className="text-neutral-500">Name</dt>
              <dd className="font-medium text-neutral-900">{student.full_name}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-neutral-500">Student ID</dt>
              <dd className="font-medium text-neutral-900">{student.student_id}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-neutral-500">Department</dt>
              <dd className="font-medium text-neutral-900">
                {student.department ?? "Not set"}
              </dd>
            </div>
          </dl>
        ) : (
          <div className="rounded-md border border-dashed border-neutral-300 p-4 text-sm text-neutral-500">
            Name, student ID and department will be shown here after a scan.
          </div>
        )}
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-medium text-neutral-900">
          Attendance Status
        </h2>
        <div className="flex flex-wrap gap-3">
          {STATUS_OPTIONS.map((option) => (
            <label
              key={option.value}
              className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm ${
                status === option.value
                  ? "border-neutral-900 bg-neutral-50"
                  : "border-neutral-300"
              }`}
            >
              <input
                type="radio"
                name="attendanceStatus"
                value={option.value}
                checked={status === option.value}
                onChange={() => setStatus(option.value)}
                className="accent-neutral-900"
              />
              {option.label}
            </label>
          ))}
        </div>

        <button
          type="button"
          onClick={() => void handleUpdate()}
          disabled={!student || saving}
          className="rounded-md bg-neutral-900 px-5 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:cursor-not-allowed disabled:bg-neutral-300"
        >
          {saving ? "Updating..." : "Update attendance"}
        </button>

        {!student ? (
          <p className="text-xs text-neutral-500">
            Scan a QR code first to enable this button.
          </p>
        ) : null}
      </div>
    </div>
  );
}
