// /og/<slug>.jpg: each project's share card.
import type { APIRoute, GetStaticPaths } from 'astro';
import { projectCard } from '../../lib/card';
import { getProjects, type Project } from '../../lib/github';

export const getStaticPaths = (async () =>
  (await getProjects()).map((project) => ({ params: { slug: project.slug }, props: { project } }))) satisfies GetStaticPaths;

export const GET: APIRoute = async ({ props }) =>
  new Response(new Uint8Array(await projectCard((props as { project: Project }).project)), {
    headers: { 'Content-Type': 'image/jpeg' },
  });
