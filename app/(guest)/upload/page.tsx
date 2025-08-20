// app/(guest)/upload/page.tsx
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useState, useRef } from "react";
import { Loader2, UploadCloud, CheckCircle, AlertTriangle, Images, FileImage, X } from "lucide-react";
import imageCompression from 'browser-image-compression';
import Link from "next/link";
import { toast } from "sonner";
import Image from "next/image";

// Constante
const MAX_FILE_SIZE = 15 * 1024 * 1024;
const MAX_FILES = 20;
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

// Schema Zod
const uploadFormSchema = z.object({
  fullName: z.string().optional(),
  albumName: z.string().optional(),
  photos: z
    .custom<FileList>()
    .refine((files) => files && files.length > 0, "Selectează cel puțin o fotografie.")
    .refine((files) => !files || files.length <= MAX_FILES, `Poți încărca maxim ${MAX_FILES} fotografii odată.`)
    .refine((files) => !files || Array.from(files).every(file => file.size <= MAX_FILE_SIZE), `Fiecare fotografie trebuie să aibă maxim 15MB.`)
    .refine((files) => !files || Array.from(files).every(file => ALLOWED_IMAGE_TYPES.includes(file.type)), "Sunt acceptate doar formatele JPG, PNG, WEBP și GIF."),
});

type UploadFormValues = z.infer<typeof uploadFormSchema>;

interface FileUploadProgress {
  file: File;
  previewUrl: string;
  status: 'pending' | 'compressing' | 'uploading' | 'success' | 'error';
  errorMessage?: string;
}

export default function UploadPage() {
  const [fileUploads, setFileUploads] = useState<FileUploadProgress[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<UploadFormValues>({
    resolver: zodResolver(uploadFormSchema),
    defaultValues: { fullName: "", albumName: "" },
    mode: "onChange",
  });
  
  const handleFilesChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) {
      form.resetField("photos");
      setFileUploads([]);
      return;
    }
    const fileArray = Array.from(files);
    if (fileArray.length > MAX_FILES) {
      toast.error("Prea multe fișiere", {
        description: `Poți selecta maxim ${MAX_FILES} fotografii.`,
      });
      form.resetField("photos");
      setFileUploads([]);
      if(fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    form.setValue("photos", files as FileList, { shouldValidate: true });
    fileUploads.forEach(upload => URL.revokeObjectURL(upload.previewUrl));
    const newFileUploads: FileUploadProgress[] = fileArray.map(file => ({
      file: file, previewUrl: URL.createObjectURL(file), status: 'pending',
    }));
    setFileUploads(newFileUploads);
  };

  const removeFile = (indexToRemove: number) => {
    URL.revokeObjectURL(fileUploads[indexToRemove].previewUrl);
    const updatedFileUploads = fileUploads.filter((_, index) => index !== indexToRemove);
    setFileUploads(updatedFileUploads);
    const dataTransfer = new DataTransfer();
    updatedFileUploads.forEach(upload => dataTransfer.items.add(upload.file));
    if (dataTransfer.files.length > 0) {
      form.setValue("photos", dataTransfer.files, { shouldValidate: true });
    } else {
      form.resetField("photos");
    }
  };

  async function onSubmit(data: UploadFormValues) {
    setIsProcessing(true);
    const filesToUpload = Array.from(data.photos);
    let successCount = 0;
    let errorCount = 0;

    const toastId = toast.loading(`Se pregătește încărcarea a ${filesToUpload.length} fotografii...`);

    // --- MODIFICARE CHEIE: Folosim un loop `for...of` pentru procesare secvențială ---
    for (const [index, file] of filesToUpload.entries()) {
      try {
        toast.loading(`Se încarcă fotografia ${index + 1} / ${filesToUpload.length}: ${file.name}`, { id: toastId });
        
        setFileUploads(prev => prev.map((upload, i) => i === index ? { ...upload, status: 'compressing' } : upload));
        const compressedFile = await imageCompression(file, { maxSizeMB: 0.5, maxWidthOrHeight: 1920, useWebWorker: true });
        
        setFileUploads(prev => prev.map((upload, i) => i === index ? { ...upload, status: 'uploading' } : upload));
        const formData = new FormData();
        formData.append('photo', compressedFile, file.name);
        if (data.fullName?.trim()) formData.append('fullName', data.fullName.trim());
        if (data.albumName?.trim()) formData.append('albumName', data.albumName.trim());
        
        const response = await fetch('/api/upload', { method: 'POST', body: formData });
        if (!response.ok) throw new Error((await response.json()).error || 'Eroare de server');
        
        setFileUploads(prev => prev.map((upload, i) => i === index ? { ...upload, status: 'success' } : upload));
        successCount++;
      } catch (err) {
        setFileUploads(prev => prev.map((upload, i) => i === index ? { ...upload, status: 'error', errorMessage: err instanceof Error ? err.message : 'Eroare' } : upload));
        errorCount++;
      }
    }

    toast.success("Procesare finalizată", {
        id: toastId,
        description: `${successCount} fotografii încărcate cu succes.${errorCount > 0 ? ` ${errorCount} erori.` : ''}`,
        duration: 8000,
    });
    
    setIsProcessing(false);
  }

  const resetForm = () => {
    form.reset();
    fileUploads.forEach(upload => URL.revokeObjectURL(upload.previewUrl));
    setFileUploads([]);
    if(fileInputRef.current) fileInputRef.current.value = "";
  };
    
  const processingFinished = !isProcessing && fileUploads.length > 0 && fileUploads.some(f => f.status === 'success' || f.status === 'error');

  return (
    <div className="container mx-auto max-w-4xl py-12 px-4">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold tracking-tight">Împărtășește Amintirile!</h1>
        <p className="text-muted-foreground mt-2">
          Selectează una sau mai multe fotografii pentru a le încărca.
        </p>
      </div>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
            <div className="space-y-8">
              <FormField control={form.control} name="fullName" render={({ field }) => (
                <FormItem><FormLabel>Numele tău complet (Opțional)</FormLabel><FormControl><Input placeholder="ex. Ion Popescu" {...field} disabled={isProcessing || processingFinished} /></FormControl><FormDescription>Așa știm cine a împărtășit aceste momente frumoase!</FormDescription><FormMessage /></FormItem>
              )}/>
              <FormField control={form.control} name="albumName" render={({ field }) => (
                <FormItem><FormLabel>Nume album (Opțional)</FormLabel><FormControl><Input placeholder="ex. Pregătiri, Ceremonia" {...field} disabled={isProcessing || processingFinished} /></FormControl><FormDescription>Organizează fotografiile în albume. Necesită completarea numelui.</FormDescription><FormMessage /></FormItem>
              )}/>
            </div>
            <FormField control={form.control} name="photos" render={({ field }) => (
              <FormItem>
                <FormLabel>Fotografiile tale*</FormLabel>
                <FormControl>
                  <div className="relative flex items-center justify-center w-full">
                    <label htmlFor="photos-file-input" className={cn("flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-lg cursor-pointer bg-gray-50 dark:bg-gray-800 transition-colors", (isProcessing || processingFinished) ? 'cursor-not-allowed opacity-50' : 'hover:bg-gray-100 dark:hover:bg-gray-700')}>
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <UploadCloud className="w-10 h-10 mb-3 text-gray-400" />
                        <p className="mb-2 text-sm text-center text-gray-500 dark:text-gray-400"><span className="font-semibold">Click pentru a alege</span><br/>sau trage fișierele aici</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Maxim {MAX_FILES} fișiere (până la 15MB fiecare)</p>
                      </div>
                      <Input id="photos-file-input" type="file" multiple accept="image/*" className="hidden" onChange={handleFilesChange} ref={fileInputRef} disabled={isProcessing || processingFinished} />
                    </label>
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}/>
          </div>
          {fileUploads.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Fișiere selectate ({fileUploads.length}):</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {fileUploads.map((upload, index) => (
                  <div key={`${upload.file.name}-${index}`} className="relative group aspect-square">
                    <Image src={upload.previewUrl} alt={`Previzualizare ${upload.file.name}`} fill className="object-cover rounded-md border" />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-md">
                      {!isProcessing && !processingFinished && (
                        <Button type="button" variant="destructive" size="icon" className="h-9 w-9" onClick={() => removeFile(index)}>
                          <X className="h-5 w-5" /><span className="sr-only">Șterge fișier</span>
                        </Button>
                      )}
                    </div>
                    {(isProcessing || processingFinished) && (
                      <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center text-white text-xs p-1 rounded-md text-center">
                        {upload.status === 'compressing' && <><Loader2 className="animate-spin h-5 w-5 mb-1" /><span>Comprimare...</span></>}
                        {upload.status === 'uploading' && <><Loader2 className="animate-spin h-5 w-5 mb-1" /><span>Încărcare...</span></>}
                        {upload.status === 'success' && <CheckCircle className="h-6 w-6 text-green-400" />}
                        {upload.status === 'error' && <><AlertTriangle className="h-6 w-6 text-red-400 mb-1" /><span className="text-center">{upload.errorMessage}</span></>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="flex flex-col sm:flex-row items-center gap-4 pt-4 border-t">
            {!processingFinished ? (
              <Button type="submit" size="lg" disabled={isProcessing || fileUploads.length === 0}>
                {isProcessing ? (<><Loader2 className="mr-2 h-5 w-5 animate-spin" /><span>Se procesează...</span></>) 
                : (<><UploadCloud className="mr-2 h-5 w-5" />Încarcă {fileUploads.length > 0 ? `${fileUploads.length} Fotografii` : 'Fotografii'}</>)}
              </Button>
            ) : (
              <Button type="button" size="lg" onClick={resetForm} variant="outline">
                <FileImage className="mr-2 h-5 w-5" />
                Încarcă Alte Fotografii
              </Button>
            )}
            {processingFinished && (
              <Button asChild size="lg">
                <Link href="/gallery"><Images className="mr-2 h-5 w-5" />Vezi Galeria</Link>
              </Button>
            )}
          </div>
        </form>
      </Form>
    </div>
  );
}