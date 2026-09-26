"use client";

// A Client Component because it holds form state and calls Supabase from the
// browser. It is the mirror image of /scanner: this page WRITES a student,
// /scanner READS one and records attendance.
//
// Pressing "Generate QR" does two things:
//   1. Saves (or updates) a row in the `students` table.
//   2. Renders a QR code containing that row's roll number.
// The text inside the QR is built by buildQrPayload() in lib/qr-payload.ts,
// and read back by parseQrPayload() on the /scanner page. Both pages must use
// the same format, which is why that lives in one shared file.

import { useState } from "react";
import QRCode from "react-qr-code";
import { buildQrPayload } from "@/lib/qr-payload";
import { supabase } from "@/lib/supabase";

type Notice = { kind: "error" | "success"; text: string };

export default function CreateQrPage() {
  // Each piece of form state is tracked separately so the two inputs can be
  // typed into independently.
  const [studentName, setStudentName] = useState("");
  const [studentId, setStudentId] = useState("");
  // qrValue is the string drawn as the QR code. null means "not generated yet",
  // which is why the page can show an empty box on first load.
  const [qrValue, setQrValue] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleGenerate() {
    // .trim() drops spaces people accidentally type at the start or end of a
    // field. Without it " CSE2023001" and "CSE2023001" become two students.
    const fullName = studentName.trim();
    const id = studentId.trim();

    if (!fullName || !id) {
      setNotice({ kind: "error", text: "Enter both a student name and a student ID." });
      return;
    }

    const payload = buildQrPayload(id);

    // Show the QR before the database call, so a Supabase problem does not hide
    // the code the student needs to show.
    setQrValue(payload);
    setNotice(null);
    setSaving(true);

    // upsert = "insert, or update if the row is already there". student_id is
    // unique in the schema, and onConflict names that column, so re-submitting
    // the same ID corrects the name instead of failing. If you would rather
    // reject duplicates, swap .upsert(...) for .insert(...) - it will then
    // report a duplicate key error for anyone who already exists.
    const { error } = await supabase
      .from("students")
      .upsert(
        { student_id: id, full_name: fullName, qr_payload: payload },
        { onConflict: "student_id" }
      );

    setSaving(false);

    // Note the difference between the two outcomes: the QR still works, it just
    // is not attached to a database row, so /scanner will not recognise it.
    setNotice(
      error
        ? {
            kind: "error",
            text: `QR created, but saving the student failed: ${error.message}`,
          }
        : { kind: "success", text: "Student saved. Show this QR to mark attendance." }
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold text-neutral-900">Create My QR</h1>
        <p className="text-sm text-neutral-600">
          Enter your details to generate a QR code you can show the teacher.
        </p>
      </div>

      <form
        onSubmit={(event) => {
          // Without this the browser reloads the page on submit, losing the
          // generated QR. `void` says "we are not awaiting this promise here".
          event.preventDefault();
          void handleGenerate();
        }}
        className="space-y-4"
      >
        <div className="space-y-1">
          <label
            htmlFor="studentName"
            className="block text-sm font-medium text-neutral-900"
          >
            Student Name
          </label>
          <input
            id="studentName"
            name="studentName"
            type="text"
            value={studentName}
            onChange={(event) => setStudentName(event.target.value)}
            placeholder="e.g. Arjun Menon"
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900"
          />
        </div>

        <div className="space-y-1">
          <label
            htmlFor="studentId"
            className="block text-sm font-medium text-neutral-900"
          >
            Student ID
          </label>
          <input
            id="studentId"
            name="studentId"
            type="text"
            value={studentId}
            onChange={(event) => setStudentId(event.target.value)}
            placeholder="e.g. CSE2023001"
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900"
          />
        </div>

        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-neutral-900 px-5 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:cursor-not-allowed disabled:bg-neutral-300"
        >
          {saving ? "Saving..." : "Generate QR"}
        </button>
      </form>

      {notice ? (
        <p className="rounded-md border border-dashed border-neutral-300 px-4 py-3 text-sm text-neutral-600">
          {notice.text}
        </p>
      ) : null}

      <div className="space-y-2">
        <h2 className="text-sm font-medium text-neutral-900">Your QR Code</h2>
        <div className="flex aspect-square w-full max-w-xs items-center justify-center rounded-md border border-dashed border-neutral-300 p-6 text-center text-sm text-neutral-500">
          {qrValue ? (
            <QRCode value={qrValue} size={200} className="h-auto w-full max-w-full" />
          ) : (
            "QR code will appear here."
          )}
        </div>
        {qrValue ? (
          <p className="break-all text-xs text-neutral-500">
            Encoded value: {qrValue}
          </p>
        ) : null}
      </div>
    </div>
  );
}
