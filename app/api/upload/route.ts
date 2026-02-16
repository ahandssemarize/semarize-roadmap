import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    const { searchParams } = new URL(request.url)
    const filename = searchParams.get("filename")

    if (!filename) {
      return NextResponse.json({ error: "Filename is required" }, { status: 400 })
    }

    // Get the file from the request body
    const fileBuffer = await request.arrayBuffer()
    const file = Buffer.from(fileBuffer)

    // Generate a unique filename to avoid conflicts
    const timestamp = Date.now()
    const uniqueFilename = `${timestamp}-${filename}`

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage.from("NODE-ATTACHMENTS").upload(uniqueFilename, file, {
      contentType: request.headers.get("content-type") || "application/octet-stream",
      upsert: false,
    })

    if (error) {
      console.error("Supabase storage error:", error)

      // If bucket doesn't exist, provide helpful error message
      if (error.message.includes("not found") || error.message.includes("does not exist")) {
        return NextResponse.json(
          {
            error:
              "Storage bucket 'NODE-ATTACHMENTS' not found. Please create it in your Supabase dashboard: Storage > Create bucket > Name: 'NODE-ATTACHMENTS' > Public: Yes",
          },
          { status: 500 },
        )
      }

      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Get the public URL
    const {
      data: { publicUrl },
    } = supabase.storage.from("NODE-ATTACHMENTS").getPublicUrl(data.path)

    return NextResponse.json({ url: publicUrl, path: data.path })
  } catch (error) {
    console.error("Upload error:", error)
    return NextResponse.json({ error: "Upload failed" }, { status: 500 })
  }
}
