import { FileText, File } from "lucide-react";
import React from "react";

/**
 * Format a file size in bytes to a human-readable string.
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Get an appropriate icon for a file based on its filename or MIME type.
 */
export function getFileIcon(filenameOrMimeType: string): React.ReactNode {
  const value = filenameOrMimeType.toLowerCase();
  
  // Check for PDF
  if (value.endsWith(".pdf") || value === "application/pdf") {
    return React.createElement(FileText, { className: "h-5 w-5 text-red-500" });
  }
  
  // Check for Word docs
  if (value.endsWith(".docx") || value.includes("wordprocessingml")) {
    return React.createElement(FileText, { className: "h-5 w-5 text-blue-500" });
  }
  
  // Check for Markdown
  if (value.endsWith(".md") || value === "text/markdown") {
    return React.createElement(FileText, { className: "h-5 w-5 text-purple-500" });
  }
  
  // Check for text files
  if (value.endsWith(".txt") || value === "text/plain") {
    return React.createElement(FileText, { className: "h-5 w-5 text-gray-500" });
  }
  
  // Default
  return React.createElement(File, { className: "h-5 w-5 text-gray-500" });
}

/**
 * Common accepted file types for resume uploads.
 */
export const RESUME_ACCEPTED_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
];

export const RESUME_ACCEPTED_EXTENSIONS = ".pdf,.docx,.txt";

/**
 * Common accepted file types for project uploads.
 */
export const PROJECT_ACCEPTED_TYPES = ["text/markdown", "text/plain"];
export const PROJECT_ACCEPTED_EXTENSIONS = ".md,.txt";

