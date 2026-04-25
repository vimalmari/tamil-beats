"""
Tamil Beats MP3 Player - Python Server
Run locally : python app.py
Deploy Render: Build = pip install -r requirements.txt
               Start = gunicorn app:app
"""

from flask import Flask, send_from_directory, send_file, make_response
import os

app = Flask(__name__, static_folder='.')

# Root
@app.route('/')
def index():
    return send_file('index.html')

# Service Worker - MUST be served from root with correct headers
@app.route('/service-worker.js')
def service_worker():
    response = make_response(send_file('service-worker.js', mimetype='application/javascript'))
    response.headers['Service-Worker-Allowed'] = '/'
    response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
    return response

# Manifest
@app.route('/manifest.json')
def manifest():
    response = make_response(send_file('manifest.json', mimetype='application/manifest+json'))
    response.headers['Cache-Control'] = 'no-cache'
    return response

# Icons
@app.route('/icons/<path:filename>')
def icons(filename):
    return send_from_directory('icons', filename)

# CSS
@app.route('/css/<path:filename>')
def css(filename):
    return send_from_directory('css', filename)

# JS
@app.route('/js/<path:filename>')
def js(filename):
    return send_from_directory('js', filename)

# Songs folder
@app.route('/songs/<path:filename>')
def songs(filename):
    return send_from_directory('songs', filename)

# Catch-all
@app.route('/<path:filename>')
def static_files(filename):
    return send_from_directory('.', filename)

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    debug = os.environ.get('FLASK_ENV') != 'production'
    print(f"\n🎵 Tamil Beats is running!")
    print(f"   Local  ->  http://localhost:{port}")
    print(f"   PWA install works after deploying on Render\n")
    app.run(host='0.0.0.0', port=port, debug=debug)
