import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase/server'

function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Supabase Service Role configuration is missing on the server.')
  }
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}

export async function POST(request: Request) {
  try {
    const supabaseServer = await createServerSupabaseClient()
    if (!supabaseServer) {
      return NextResponse.json({ error: 'Database client not initialized' }, { status: 500 })
    }

    const { data: { user: caller } } = await supabaseServer.auth.getUser()
    if (!caller) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const bucketName = (formData.get('bucket') as string) || 'violation-photos'
    const customPath = (formData.get('path') as string) || ''

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const adminClient = getAdminClient()

    // 1. Ensure bucket exists or create it
    try {
      const { data: bucket, error: getBucketErr } = await adminClient.storage.getBucket(bucketName)
      if (getBucketErr || !bucket) {
        await adminClient.storage.createBucket(bucketName, {
          public: true,
          fileSizeLimit: 10485760 // 10MB
        })
      }
    } catch (bErr) {
      console.warn('Bucket verification or creation note:', bErr)
    }

    // 2. Prepare file buffer & path
    const buffer = Buffer.from(await file.arrayBuffer())
    const fileExt = file.name.split('.').pop() || 'jpg'
    const filePath = customPath || `${caller.id}/${Date.now()}_photo.${fileExt}`

    // 3. Upload file using Admin Service Role to bypass storage RLS
    const { data: uploadData, error: uploadErr } = await adminClient.storage
      .from(bucketName)
      .upload(filePath, buffer, {
        contentType: file.type || 'image/jpeg',
        upsert: true
      })

    if (uploadErr) {
      console.error('Storage upload error:', uploadErr)
      return NextResponse.json({ error: uploadErr.message }, { status: 500 })
    }

    // 4. Retrieve public URL
    const { data: { publicUrl } } = adminClient.storage
      .from(bucketName)
      .getPublicUrl(filePath)

    return NextResponse.json({ success: true, publicUrl, filePath })
  } catch (err: any) {
    console.error('Upload route exception:', err)
    return NextResponse.json({ error: err.message || 'Upload failed' }, { status: 500 })
  }
}
