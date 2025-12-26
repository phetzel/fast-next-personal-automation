"use client";

import { useState, useRef } from "react";
import { Button, Card, CardContent, Input } from "@/components/ui";
import { formatFileSize, getFileIcon } from "@/lib/file-utils";
import { Loader2, Upload } from "lucide-react";

interface FileUploadZoneProps {
  /**
   * Callback when a file is uploaded with a name.
   */
  onUpload: (file: File, name: string) => Promise<void>;
  /**
   * Whether an upload is currently in progress.
   */
  isUploading: boolean;
  /**
   * Array of accepted MIME types (e.g., ["application/pdf", "text/plain"]).
   */
  acceptedTypes: string[];
  /**
   * File extensions for the file input accept attribute (e.g., ".pdf,.docx,.txt").
   */
  acceptedExtensions: string;
  /**
   * Label describing the max file size (e.g., "max 10MB").
   */
  maxSizeLabel?: string;
  /**
   * Placeholder text for the name input.
   */
  namePlaceholder?: string;
  /**
   * Label for the name input field.
   */
  nameLabel?: string;
  /**
   * Description of accepted file types shown to user.
   */
  acceptedTypesLabel?: string;
}

/**
 * A reusable file upload drop zone component.
 * Supports drag-and-drop, file browsing, and naming the upload.
 */
export function FileUploadZone({
  onUpload,
  isUploading,
  acceptedTypes,
  acceptedExtensions,
  maxSizeLabel = "max 10MB",
  namePlaceholder = "Enter a name for this file",
  nameLabel = "Name",
  acceptedTypesLabel,
}: FileUploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Generate default label from extensions if not provided
  const displayTypesLabel =
    acceptedTypesLabel ||
    acceptedExtensions
      .split(",")
      .map((ext) => ext.replace(".", "").toUpperCase())
      .join(", ");

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const isAcceptedFile = (file: File): boolean => {
    // Check MIME type
    if (acceptedTypes.includes(file.type)) {
      return true;
    }
    // Fall back to checking extension
    const extensions = acceptedExtensions.split(",").map((ext) => ext.trim().toLowerCase());
    return extensions.some((ext) => file.name.toLowerCase().endsWith(ext));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file && isAcceptedFile(file)) {
      setSelectedFile(file);
      // Set default name from filename without extension
      const defaultName = file.name.replace(/\.[^/.]+$/, "");
      setName(defaultName);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      // Set default name from filename without extension
      const defaultName = file.name.replace(/\.[^/.]+$/, "");
      setName(defaultName);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !name.trim()) return;
    await onUpload(selectedFile, name.trim());
    setSelectedFile(null);
    setName("");
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleCancel = () => {
    setSelectedFile(null);
    setName("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-4">
      {/* Dropzone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`
          cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition-colors
          ${isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"}
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={acceptedExtensions}
          onChange={handleFileSelect}
          className="hidden"
        />
        <Upload className="mx-auto h-8 w-8 text-muted-foreground" />
        <p className="mt-2 text-sm font-medium">Drop a file here or click to browse</p>
        <p className="text-xs text-muted-foreground">
          {displayTypesLabel} ({maxSizeLabel})
        </p>
      </div>

      {/* Selected file preview */}
      {selectedFile && (
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-start gap-4">
              {getFileIcon(selectedFile.name)}
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{selectedFile.name}</p>
                <p className="text-xs text-muted-foreground">
                  {formatFileSize(selectedFile.size)}
                </p>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <label className="mb-1 block text-sm font-medium">{nameLabel}</label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={namePlaceholder}
                  maxLength={100}
                />
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={handleUpload}
                  disabled={isUploading || !name.trim()}
                  className="flex-1"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" />
                      Upload
                    </>
                  )}
                </Button>
                <Button variant="outline" onClick={handleCancel} disabled={isUploading}>
                  Cancel
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

