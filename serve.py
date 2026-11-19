"""Local dev server for docs/ that tells the browser never to cache.

Usage: python serve.py   ->   http://localhost:8000
"""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


if __name__ == "__main__":
    handler = partial(NoCacheHandler, directory="docs")
    print("Serving docs/ at http://localhost:8000 (no-store)")
    ThreadingHTTPServer(("", 8000), handler).serve_forever()
