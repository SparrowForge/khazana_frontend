import api from "./api";

export interface MediaFile {
  id: string;
  fileName: string;
  fileUrl: string;
  fileType: string;
  mimeType: string;
  fileSize: number;
  altText?: string | null;
  cloudinaryPublicId: string;
  uploadedById?: string | null;
  isDelete: boolean;
  createdAt: string;
  updatedAt: string;
}

/** POST /upload — returns the full media_files DB record. Store the returned id as the FK in your payload. */
export const uploadFile = async (file: File): Promise<MediaFile> => {
  const form = new FormData();
  form.append("file", file);
  const res = await api.post<MediaFile>("/upload", form, {
    headers: { "Content-Type": undefined },
  });
  return res.data;
};
