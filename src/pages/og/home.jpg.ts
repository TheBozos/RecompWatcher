// /og/home.jpg: the Browser's share card.
import type { APIRoute } from 'astro';
import { homeCard } from '../../lib/card';
import { getProjects } from '../../lib/github';

export const GET: APIRoute = async () =>
  new Response(new Uint8Array(await homeCard(await getProjects())), { headers: { 'Content-Type': 'image/jpeg' } });
