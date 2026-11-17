"""Bounded PDF extraction. Uploaded files are never saved to application storage."""

from dataclasses import dataclass

from fastapi import HTTPException, UploadFile
import pymupdf

from .config import get_settings

MAX_PAGES = 20
MAX_RESUME_TEXT = 60000


@dataclass
class ExtractedPDF:
    text: str
    page_count: int
    filename: str
    warnings: list[str]


async def read_upload(file: UploadFile) -> bytes:
    try:
        if not file.filename or not file.filename.lower().endswith(".pdf"):
            raise HTTPException(415, "Please choose a PDF file ending in .pdf.")
        if file.content_type not in (None, "", "application/pdf", "application/octet-stream"):
            raise HTTPException(415, "This upload must be a PDF file.")
        limit = get_settings().max_upload_bytes
        data = await file.read(limit + 1)
        if len(data) > limit:
            raise HTTPException(413, f"PDF must be no larger than {limit // (1024 * 1024)} MB.")
        if not data:
            raise HTTPException(422, "The PDF is empty. Please choose another file.")
        return data
    finally:
        await file.close()


def extract_pdf(data: bytes, filename: str, max_characters: int = MAX_RESUME_TEXT) -> ExtractedPDF:
    if b"%PDF-" not in data[:1024]:
        raise HTTPException(415, "The file contents are not a PDF, even if its name ends in .pdf.")
    try:
        with pymupdf.open(stream=data, filetype="pdf") as document:
            if not document.is_pdf:
                raise HTTPException(415, "The uploaded document is not a PDF.")
            if document.needs_pass:
                raise HTTPException(422, "This PDF is password protected. Upload an unlocked copy.")
            if not 1 <= document.page_count <= MAX_PAGES:
                raise HTTPException(422, f"Please upload a PDF with 1 to {MAX_PAGES} pages.")
            pages, blank_pages = [], []
            total = 0
            for index, page in enumerate(document):
                text = page.get_text("text", sort=True).strip()
                total += len(text) + 2
                if total > max_characters:
                    raise HTTPException(422, f"This document contains too much text (limit {max_characters:,} characters). Use a shorter PDF.")
                if len(text) < 20:
                    blank_pages.append(str(index + 1))
                pages.append(text)
            combined = "\n\n".join(pages).strip()
            if len(combined) < 20:
                raise HTTPException(422, "No usable selectable text was found. Scanned/image-only PDFs need OCR first; upload a text-based PDF.")
            warnings = []
            if blank_pages:
                warnings.append("Little or no selectable text on page(s) " + ", ".join(blank_pages) + ". Image content is not extracted.")
            if document.is_repaired:
                warnings.append("The PDF needed structural repair. Check the extracted text carefully.")
            return ExtractedPDF(
                combined, document.page_count,
                filename.replace("\\", "/").split("/")[-1][:150], warnings,
            )
    except HTTPException:
        raise
    except (RuntimeError, ValueError, pymupdf.FileDataError) as exc:
        raise HTTPException(422, "This PDF could not be read. Try exporting a fresh, unlocked PDF.") from exc
