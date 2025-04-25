from flask import Flask, send_file, send_from_directory
import os


app = Flask(__name__, static_folder='public')

# Serve the main HTML file
@app.route('/')
def index():
    return send_file('public/index.html')

# Handle Spotify callback
@app.route('/callback')
def callback():
    return send_file('public/index.html')

# Serve static files (CSS, JS)
@app.route('/<path:filename>')
def serve_static(filename):
    return send_from_directory('public', filename)

if __name__ == '__main__':
    # Create public directory if it doesn't exist
    if not os.path.exists('public'):
        os.makedirs('public')
    app.run(port=9001, debug=True)