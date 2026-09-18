import { NextResponse } from 'next/server'
import { requireAnyV2Permission } from '@/server/authorization/http-guard'
import { getAdminSupabaseClient } from '@/server/supabase/admin'

const ALLOWED_BUCKET = 'violation-photos'
const MAX_FILE_BYTES = 10 * 1024 * 1024

const UPLOAD_PERMISSIONS = [
  'mission_results.record',
  'mission_results.edit',
  'violations.create',
  'violations.correct',
] as const

function safeExtension(fileName: string): string {
  const candidate = fileName.split('.').pop()?.toLowerCase() || 'jpg'
  return /^[a-z0-9]{2,5}$/.test(candidate) ? candidate : 'jpg'
}

export async function POST(request: Request) {
  try {
    const gate = await requireAnyV2Permission(UPLOAD_PERMISSIONS)
    if (!gate.ok) return gate.response

    const formData = await request.formData()
    const file = formData.get('file')

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (!file.type.startsWith('image/')) {
      return NextResponse.json(
        { error: 'يسمح برفع ملفات الصور فقط' },
        { status: 400 }
      )
    }

    if (file.size <= 0 || file.size > MAX_FILE_BYTES) {
      return NextResponse.json(
        { error: 'حجم الصورة غير صالح أو يتجاوز 10 ميجابايت' },
        { status: 400 }
      )
    }

    const requestedBucket = formData.get('bucket')
    if (
      requestedBucket !== null &&
      String(requestedBucket) !== ALLOWED_BUCKET
    ) {
      return NextResponse.json(
        { error: 'Bucket غير مسموح به' },
        { status: 400 }
      )
    }

    const admin = getAdminSupabaseClient()

    const { data: bucket, error: bucketError } =
      await admin.storage.getBucket(ALLOWED_BUCKET)

    if (bucketError || !bucket) {
      const { error: createBucketError } =
        await admin.storage.createBucket(ALLOWED_BUCKET, {
          public: true,
          fileSizeLimit: MAX_FILE_BYTES,
        })

      if (createBucketError) {
        console.error(
          '[upload] bucket creation failed:',
          createBucketError.message
        )
        return NextResponse.json(
          { error: 'تعذر تجهيز مساحة رفع الصور' },
          { status: 500 }
        )
      }
    }

    const extension = safeExtension(file.name)
    const filePath =
      `${gate.user.profileId}/${Date.now()}-${crypto.randomUUID()}.${extension}`

    const buffer = Buffer.from(await file.arrayBuffer())

    const { error: uploadError } = await admin.storage
      .from(ALLOWED_BUCKET)
      .upload(filePath, buffer, {
        contentType: file.type || 'image/jpeg',
        upsert: false,
      })

    if (uploadError) {
      console.error('[upload] storage upload failed:', uploadError.message)
      return NextResponse.json(
        { error: 'تعذر رفع الصورة' },
        { status: 500 }
      )
    }

    const {
      data: { publicUrl },
    } = admin.storage.from(ALLOWED_BUCKET).getPublicUrl(filePath)

    return NextResponse.json({
      success: true,
      publicUrl,
      filePath,
    })
  } catch (error) {
    console.error('[upload] unexpected error:', error)
    return NextResponse.json(
      { error: 'Upload failed' },
      { status: 500 }
    )
  }
}
