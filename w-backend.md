Searched web: "free container hosting no credit card 2026 RAM 4GB 8GB 16GB python docker free tier"
Searched web: "GitHub Actions standard runner public repository free unlimited minutes RAM vCPU job time limit 2026"
Searched web: "Kaggle notebook CPU session limit hours RAM free no weekly quota CPU 2026"

Without a GPU there are really only two good options. Hugging Face is the only free, no-card service with enough RAM to run Chatterbox as an always-on server. GitHub Actions has no quota at all, but it works as a batch job, not a live server.

| Option | Card | Type | CPU / RAM | Usage limit | Other limits |
|---|---|---|---|---|---|
| **Hugging Face Space, free CPU** | No | Always-on web API | 2 CPUs / 16 GB | **None** | Sleeps after 48 h idle, about 1–3 min to wake |
| **GitHub Actions (public repo)** | No | **Batch job**, not a live server | 4 CPUs / 16 GB on public repos (I recall this; not confirmed in this search) | **Unlimited minutes** on public repos | 6 h maximum per job; starting a job takes about 20–60 s |
| Kaggle notebook (CPU) | No (phone verification) | Notebook, not a server | 4 CPUs / 30 GB | No weekly CPU quota | 12 h per session; about 20 min idle timeout; no public web address |
| Google Colab (CPU) | No | Notebook | 2 CPUs / about 12 GB | Not published | About 12 h per session; about 90 min idle timeout; only reachable through a tunnel |
| Claw Cloud | No | Container | Up to 4 CPUs / 8 GB | $5 of credit per month, which runs out in days at 8 GB | Not enough to keep Chatterbox running all the time |
| Render, Railway, SnapDeploy | No | Container | 0.5–1 GB RAM or less | Varies | **Too little RAM for Chatterbox** |
| Oracle Cloud, Fly.io, Koyeb, AWS, Google Cloud, Azure | **Yes** | — | — | — | Excluded |

**How GitHub Actions would work for audiobooks:**
1. The GitHub Pages site opens a pre-filled GitHub issue (or you commit a `.txt` file).
2. An Action generates the audio with Chatterbox V3.
3. It attaches the MP3 to a Release and comments the download link on the issue.

There's no live waiting on the page, but it handles whole chapters in one run (up to 6 hours) and nothing sleeps. A pre-filled issue link can hold only about 8,000 characters (my estimate), so for whole chapters you'd commit a file instead.

**My suggestion:**
- **For the MVP (type text, convert, download right away):** the Hugging Face CPU Space.
- **For whole-book generation:** GitHub Actions.
- You can have both. They'd use the same script, [chatterbox_tts.py](file:///c:/code/audiobook/chatterbox_tts.py), which the other agent is setting up.

Which one should I plan?