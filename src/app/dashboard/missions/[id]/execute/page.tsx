import { redirect } from 'next/navigation'

type PageProps = {
  params: Promise<{ id: string }>
  searchParams: Promise<{ returnTo?: string }>
}

function safeReturnHref(value: string | undefined) {
  if (
    value &&
    value.startsWith('/v2/missions/assignments/') &&
    value.endsWith('/execute')
  ) {
    return value
  }

  return '/v2/missions'
}

export default async function LegacyMissionExecuteRedirect({
  params,
  searchParams,
}: PageProps) {
  const { id } = await params
  const query = await searchParams
  const returnHref = safeReturnHref(query.returnTo)

  redirect(
    '/v2/missions/' +
      encodeURIComponent(id) +
      '/execute?returnTo=' +
      encodeURIComponent(returnHref)
  )
}
