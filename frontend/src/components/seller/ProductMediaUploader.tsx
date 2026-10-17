"use client";

import { useRef, useState, useEffect } from "react";
import axios, { type AxiosProgressEvent } from "axios";
import {
  ImagePlus, Star, Trash2, Loader2, Film, X, AlertTriangle, Info, Video,
} from "lucide-react";
import { sellerDashboardApi, type VideoUploadSignature } from "@/lib/api";
import { compressImage } from "@/lib/imageCompression";

export interface UploaderImage {
  id: string;
  image: string;
  is_primary?: boolean;
  order?: number;
}

interface Props {
  productId: string;
  initialImages?: UploaderImage[];
  initialVideoUrl?: string | null;
  /** Notifica o pai quando a contagem de mídia muda (ex: habilitar botão publicar). */
  onChange?: (state: { images: UploaderImage[]; videoUrl: string | null }) => void;
  className?: string;
}

const MAX_PHOTOS = 6;
// Limite só como rede de segurança: a imagem é comprimida no navegador antes de
// subir (compressImage), então fotos de celular passam tranquilamente.
const MAX_PHOTO_MB = 10;
const MAX_VIDEO_MB = 50;
const ACCEPTED_VIDEO = ["video/mp4", "video/webm", "video/quicktime"];

export function ProductMediaUploader({
  productId,
  initialImages = [],
  initialVideoUrl = null,
  onChange,
  className = "",
}: Props) {
  const [images, setImages] = useState<UploaderImage[]>(initialImages);
  const [videoUrl, setVideoUrl] = useState<string | null>(initialVideoUrl);

  useEffect(() => {
    setImages(initialImages);
  }, [initialImages]);

  useEffect(() => {
    setVideoUrl(initialVideoUrl);
  }, [initialVideoUrl]);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [videoProgress, setVideoProgress] = useState<number | null>(null);
  const [busyImageId, setBusyImageId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [externalUrlInput, setExternalUrlInput] = useState("");

  const photoInput = useRef<HTMLInputElement>(null);
  const videoInput = useRef<HTMLInputElement>(null);

  const remaining = MAX_PHOTOS - images.length;

  const emit = (imgs: UploaderImage[], vid: string | null) => {
    onChange?.({ images: imgs, videoUrl: vid });
  };

  const handleAddExternalUrl = async () => {
    if (!externalUrlInput.trim()) return;
    if (images.length >= MAX_PHOTOS) {
      setError(`Você pode adicionar no máximo ${MAX_PHOTOS} fotos.`);
      return;
    }
    setError("");
    setUploadingPhotos(true);
    try {
      const fd = new FormData();
      fd.append("external_url", externalUrlInput.trim());
      fd.append("order", String(images.length));
      const { data } = await sellerDashboardApi.products.uploadImage(productId, fd);
      const newImages = [...images, { id: data.id, image: data.image_url || data.external_url, is_primary: data.is_primary, order: data.order }];
      setImages(newImages);
      emit(newImages, videoUrl);
      setExternalUrlInput("");
    } catch (err: any) {
      setError(err.response?.data?.detail || "Falha ao adicionar a foto por URL.");
    } finally {
      setUploadingPhotos(false);
    }
  };

  const handleAddPhotos = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setError("");
    const files = Array.from(fileList);

    if (files.length > remaining) {
      setError(`Você pode adicionar no máximo ${MAX_PHOTOS} fotos. Restam ${remaining}.`);
    }
    const toUpload = files.slice(0, remaining);

    setUploadingPhotos(true);
    let current = [...images];
    for (const original of toUpload) {
      if (!original.type.startsWith("image/")) {
        setError("Apenas imagens são aceitas (JPG, PNG ou WebP).");
        continue;
      }
      // Comprime no navegador antes de qualquer coisa — resolve o limite na origem.
      const file = await compressImage(original);
      if (file.size > MAX_PHOTO_MB * 1024 * 1024) {
        setError(`"${original.name}" é muito grande mesmo após otimizar. Tente uma foto menor.`);
        continue;
      }
      try {
        const fd = new FormData();
        fd.append("image", file);
        fd.append("order", String(current.length));
        const { data } = await sellerDashboardApi.products.uploadImage(productId, fd);
        current = [...current, { id: data.id, image: data.image_url || data.image, is_primary: data.is_primary, order: data.order }];
        setImages(current);
        emit(current, videoUrl);
      } catch (err: any) {
        setError(
          err.response?.data?.detail ||
            err.response?.data?.image?.[0] ||
            "Falha ao enviar uma das fotos."
        );
      }
    }
    setUploadingPhotos(false);
    if (photoInput.current) photoInput.current.value = "";
  };

  const handleRemovePhoto = async (id: string) => {
    setBusyImageId(id);
    setError("");
    try {
      await sellerDashboardApi.products.deleteImage(productId, id);
      const next = images.filter((i) => i.id !== id);
      // Se removeu a capa, promove a primeira restante localmente (backend já faz isso).
      if (next.length && !next.some((i) => i.is_primary)) next[0].is_primary = true;
      setImages(next);
      emit(next, videoUrl);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Falha ao remover a foto.");
    } finally {
      setBusyImageId(null);
    }
  };

  const handleSetCover = async (id: string) => {
    setBusyImageId(id);
    setError("");
    try {
      await sellerDashboardApi.products.setPrimaryImage(productId, id);
      const next = images.map((i) => ({ ...i, is_primary: i.id === id }));
      setImages(next);
      emit(next, videoUrl);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Falha ao definir a capa.");
    } finally {
      setBusyImageId(null);
    }
  };

  const handleVideo = async (fileList: FileList | null) => {
    const file = fileList?.[0];
    if (!file) return;
    setError("");
    if (!ACCEPTED_VIDEO.includes(file.type)) {
      setError("Vídeo deve ser MP4, WebM ou MOV.");
      return;
    }
    if (file.size > MAX_VIDEO_MB * 1024 * 1024) {
      setError(`O vídeo passa de ${MAX_VIDEO_MB}MB. Use um clipe mais curto ou comprima.`);
      return;
    }
    setUploadingVideo(true);
    setVideoProgress(0);
    try {
      const url = await sendVideo(file);
      setVideoUrl(url);
      emit(images, url);
    } catch (err: any) {
      setError(
        err.response?.data?.detail ||
          err.response?.data?.error?.message ||
          "Falha ao enviar o vídeo."
      );
    } finally {
      setUploadingVideo(false);
      setVideoProgress(null);
      if (videoInput.current) videoInput.current.value = "";
    }
  };

  /**
   * Vídeo vai direto do navegador ao Cloudinary (assinatura da API): os bytes não passam
   * pela VM da API (1 GB). Sem Cloudinary (dev) ou com API antiga, cai no multipart.
   */
  const sendVideo = async (file: File): Promise<string> => {
    const onUploadProgress = (e: AxiosProgressEvent) => {
      if (e.total) setVideoProgress(Math.round((e.loaded / e.total) * 100));
    };
    let sig: VideoUploadSignature = { direct: false };
    try {
      ({ data: sig } = await sellerDashboardApi.products.videoUploadSignature(productId));
    } catch (err: any) {
      if (err.response?.status !== 404) throw err;
    }

    if (!sig.direct) {
      const fd = new FormData();
      fd.append("video", file);
      const { data } = await sellerDashboardApi.products.uploadVideo(productId, fd, onUploadProgress);
      return data.video_url;
    }

    const fd = new FormData();
    Object.entries(sig.params).forEach(([k, v]) => fd.append(k, String(v)));
    fd.append("api_key", sig.api_key);
    fd.append("signature", sig.signature);
    fd.append("file", file);
    // axios "puro" (sem o interceptor da API): o token do lojista não vai para o Cloudinary.
    await axios.post(sig.upload_url, fd, { onUploadProgress });
    const { data } = await sellerDashboardApi.products.attachVideo(productId, sig.params.public_id);
    return data.video_url;
  };

  const handleRemoveVideo = async () => {
    setUploadingVideo(true);
    setError("");
    try {
      await sellerDashboardApi.products.deleteVideo(productId);
      setVideoUrl(null);
      emit(images, null);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Falha ao remover o vídeo.");
    } finally {
      setUploadingVideo(false);
    }
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* ---- FOTOS ---- */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400 flex items-center gap-2">
            <ImagePlus className="w-4 h-4" /> Fotos do produto
          </label>
          <span className={`text-xs font-bold ${images.length >= MAX_PHOTOS ? "text-emerald-400" : "text-neutral-500"}`}>
            {images.length}/{MAX_PHOTOS}
          </span>
        </div>
        <p className="text-xs text-neutral-500 mb-3 flex items-center gap-1.5">
          <Info className="w-3.5 h-3.5" /> Até 6 fotos. A 1ª é a <strong className="text-neutral-300">capa</strong>. Ideal: 1080×1080, fundo claro, boa luz.
        </p>

        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 mb-4">
          {images.map((img) => (
            <div
              key={img.id}
              className="relative aspect-square rounded-xl overflow-hidden border border-white/10 bg-black/30 group"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.image} alt="Foto do produto" className="w-full h-full object-cover" />

              {img.is_primary && (
                <span className="absolute top-1.5 left-1.5 z-10 text-[10px] font-black uppercase tracking-wide bg-[#E6B53C] text-black px-2 py-0.5 rounded-md flex items-center gap-1">
                  <Star className="w-3 h-3 fill-current" /> Capa
                </span>
              )}

              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                {busyImageId === img.id ? (
                  <Loader2 className="w-5 h-5 animate-spin text-white" />
                ) : (
                  <>
                    {!img.is_primary && (
                      <button
                        type="button"
                        onClick={() => handleSetCover(img.id)}
                        title="Definir como capa"
                        className="p-2 rounded-lg bg-white/10 hover:bg-[#E6B53C] hover:text-black text-white transition-colors"
                      >
                        <Star className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleRemovePhoto(img.id)}
                      title="Remover foto"
                      className="p-2 rounded-lg bg-white/10 hover:bg-red-500 text-white transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}

          {images.length < MAX_PHOTOS && (
            <button
              type="button"
              onClick={() => photoInput.current?.click()}
              disabled={uploadingPhotos}
              className="aspect-square rounded-xl border-2 border-dashed border-white/20 hover:border-[#E6B53C]/60 hover:bg-[#E6B53C]/5 transition-all flex flex-col items-center justify-center gap-1 text-neutral-500 hover:text-[#E6B53C] disabled:opacity-50"
            >
              {uploadingPhotos ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                <>
                  <ImagePlus className="w-6 h-6" />
                  <span className="text-[11px] font-semibold text-center leading-tight">Enviar<br/>Arquivo</span>
                </>
              )}
            </button>
          )}
        </div>

        {images.length < MAX_PHOTOS && (
          <div className="flex items-center gap-2 mb-2">
            <input 
              type="url" 
              placeholder="Ou cole uma URL externa (ex: Imgur, Google) p/ evitar perda" 
              value={externalUrlInput} 
              onChange={e => setExternalUrlInput(e.target.value)} 
              className="flex-1 px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white text-sm focus:border-[#E6B53C] outline-none" 
            />
            <button 
              type="button" 
              onClick={handleAddExternalUrl} 
              disabled={!externalUrlInput.trim() || uploadingPhotos} 
              className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium text-sm transition-colors disabled:opacity-50"
            >
              Adicionar Link
            </button>
          </div>
        )}

        <input
          ref={photoInput}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => handleAddPhotos(e.target.files)}
        />
      </div>

      {/* ---- VÍDEO ---- */}
      <div>
        <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400 flex items-center gap-2 mb-2">
          <Film className="w-4 h-4" /> Vídeo do produto <span className="text-neutral-600 normal-case font-normal">(opcional, 1)</span>
        </label>

        {videoUrl ? (
          <div className="relative rounded-xl overflow-hidden border border-white/10 bg-black/40">
            <video src={videoUrl} controls className="w-full max-h-72 bg-black" />
            <button
              type="button"
              onClick={handleRemoveVideo}
              disabled={uploadingVideo}
              className="absolute top-2 right-2 p-2 rounded-lg bg-black/70 hover:bg-red-500 text-white transition-colors disabled:opacity-50"
              title="Remover vídeo"
            >
              {uploadingVideo ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => videoInput.current?.click()}
            disabled={uploadingVideo}
            className="w-full h-28 rounded-xl border-2 border-dashed border-white/20 hover:border-[#E6B53C]/60 hover:bg-[#E6B53C]/5 transition-all flex flex-col items-center justify-center gap-1.5 text-neutral-500 hover:text-[#E6B53C] disabled:opacity-50"
          >
            {uploadingVideo ? (
              <>
                <Loader2 className="w-7 h-7 animate-spin" />
                <span className="text-xs font-semibold">
                  Enviando vídeo...{videoProgress !== null && videoProgress > 0 ? ` ${videoProgress}%` : ""}
                </span>
              </>
            ) : (
              <>
                <Video className="w-7 h-7" />
                <span className="text-xs font-semibold">Adicionar vídeo (MP4/WebM/MOV, até {MAX_VIDEO_MB}MB)</span>
              </>
            )}
          </button>
        )}
        <input
          ref={videoInput}
          type="file"
          accept={ACCEPTED_VIDEO.join(",")}
          className="hidden"
          onChange={(e) => handleVideo(e.target.files)}
        />
      </div>

      {error && (
        <div className="text-sm px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}
    </div>
  );
}
