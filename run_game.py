import http.server
import socketserver
import webbrowser
import os
import time

PORT = 8000
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

class MyTCPServer(socketserver.TCPServer):
    allow_reuse_address = True

class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

if __name__ == '__main__':
    try:
        with MyTCPServer(("", PORT), Handler) as httpd:
            url = f"http://localhost:{PORT}/index.html?nocache={int(time.time())}"
            print(f"Servidor rodando em {url}")
            print("Pressione Ctrl+C no terminal para encerrar o servidor.")
            
            # Abre o navegador automaticamente
            webbrowser.open(url)
            
            # Mantém o servidor rodando
            httpd.serve_forever()
            
    except KeyboardInterrupt:
        print("\nServidor encerrado.")
    except OSError as e:
        # Erro 10048 no Windows ou 98 no Linux significa que a porta já está em uso
        if e.errno == 98 or e.errno == 10048:
            print(f"A porta {PORT} já está em uso. O servidor provavelmente já está rodando.")
            webbrowser.open(f"http://localhost:{PORT}")
        else:
            raise
