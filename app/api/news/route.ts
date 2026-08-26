import { handleNewsPost } from "@/features/news/server/news-collector-route.server";
import { handleNewsGet } from "@/features/news/server/news-get-route.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export const GET = handleNewsGet;
export const POST = handleNewsPost;
