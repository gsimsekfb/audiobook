Searched web: "free tier hosting 2026 static frontend Vercel Netlify Cloudflare Pages GitHub Pages credit card required"
Searched web: "free backend hosting 2026 Render Railway Fly.io Supabase Firebase Cloudflare Workers R2 free tier credit card required"

Yes, there are several free options. The main limit for an audiobook app is storage and bandwidth for the audio files. I checked these against free-tier info as of October 2026, but limits change often.

**Frontend (static site)**

| Option | Simplicity | Card needed | Main limit |
|---|---|---|---|
| GitHub Pages | ⭐⭐⭐⭐⭐ | No | 1 GB site, 100 GB/month traffic |
| Cloudflare Pages | ⭐⭐⭐⭐ | No | Unlimited traffic, max 25 MB per file |
| Netlify | ⭐⭐⭐⭐⭐ | No | Monthly credits; site pauses when they run out |
| Vercel | ⭐⭐⭐⭐⭐ | No | 100 GB/month traffic, personal use only |

**Backend, storage and database**

| Option | Simplicity | Card needed | Main limit |
|---|---|---|---|
| Supabase (database, login, file storage) | ⭐⭐⭐⭐ | No | 1 GB files; pauses after 1 week with no activity |
| Render (server) | ⭐⭐⭐⭐ | No | Sleeps after 15 min idle (about 60 s to wake up); free database deleted after 30 days |
| Firebase Spark (database, login) | ⭐⭐⭐ | No | File storage now needs the paid plan, so a card |
| Cloudflare Workers | ⭐⭐⭐ | No | 100k requests a day |
| Cloudflare R2 (audio storage) | ⭐⭐⭐ | Yes | 10 GB, no download fees |
| Hugging Face Spaces | ⭐⭐⭐⭐ | No | Sleeps when idle |
| Railway | ⭐⭐⭐⭐⭐ | No | Only $1/month credit, not enough to stay on all the time |
| Fly.io | ⭐⭐⭐ | Yes, after trial | No real free tier |
| Oracle Cloud Always Free | ⭐ | Yes | Full virtual machine, but you set it all up yourself |

**Simplest setup:** GitHub Pages or Cloudflare Pages for the site, with the audio files hosted there too if they fit the size limits. Add Supabase only if you need logins.