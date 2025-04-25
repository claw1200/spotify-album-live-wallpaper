// Spotify API configuration
const SPOTIFY_CLIENT_ID = '524ea17d26f64c1dbd8ba951ce483297'; // Replace this with your actual Client ID from Spotify Developer Dashboard
const SPOTIFY_REDIRECT_URI = 'https://api.utilitybelt.app/callback';
const SPOTIFY_SCOPES = 'user-library-read user-library-modify'; // Updated scope for liked songs

// Canvas setup
const canvas = document.getElementById('albumCanvas');
const ctx = canvas.getContext('2d');

// Animation configuration
const config = {
    scrollSpeed: 2,
    coverSize: 400,
    spacing: 0,
    borderRadius: 10,
    direction: { x: 0.9, y: 1 }, // 1 for right, -1 for left, 0 for no movement
    alternatingColumns: false,
    shouldShuffle: true
};

let albumCovers = [];
let accessToken = null;
let loadedImages = new Map(); // Cache for loaded images

// Initialize the application
async function init() {
    // Set canvas size to window size
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Get access token from URL or redirect to Spotify login
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    accessToken = params.get('access_token');

    if (!accessToken) {
        redirectToSpotifyLogin();
    } else {
        await fetchLikedSongs();
        animate();
    }
}

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

function redirectToSpotifyLogin() {
    const authUrl = `https://accounts.spotify.com/authorize?client_id=${SPOTIFY_CLIENT_ID}&redirect_uri=${encodeURIComponent(SPOTIFY_REDIRECT_URI)}&scope=${encodeURIComponent(SPOTIFY_SCOPES)}&response_type=token`;
    window.location.href = authUrl;
}

async function fetchLikedSongs() {
    try {
        const response = await axios.get('https://api.spotify.com/v1/me/tracks?limit=50', {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });

        // Create a Set to track unique album cover URLs
        const uniqueUrls = new Set();
        
        albumCovers = response.data.items
            .map(item => item.track.album.images[0].url)
            .filter(url => {
                if (uniqueUrls.has(url)) return false;
                uniqueUrls.add(url);
                return true;
            })
            .map(url => ({
                url,
                x: 0,
                y: 0,
                width: config.coverSize,
                height: config.coverSize,
                image: null // Will store the loaded image
            }));

        if (config.shouldShuffle) {
            shuffleArray(albumCovers);
        }

        // Preload all images
        await Promise.all(albumCovers.map(cover => loadImage(cover)));

        // Initialize positions
        initializePositions();
    } catch (error) {
        console.error('Error fetching liked songs:', error);
    }
}

function loadImage(cover) {
    return new Promise((resolve, reject) => {
        if (loadedImages.has(cover.url)) {
            cover.image = loadedImages.get(cover.url);
            resolve();
        } else {
            const img = new Image();
            img.onload = () => {
                loadedImages.set(cover.url, img);
                cover.image = img;
                resolve();
            };
            img.onerror = reject;
            img.src = cover.url;
        }
    });
}

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

function initializePositions() {
    // Calculate how many images needed to fill screen width plus buffer
    const imagesNeededForWidth = Math.ceil(canvas.width / (config.coverSize + config.spacing)) + 2;
    const imagesNeededForHeight = Math.ceil(canvas.height / (config.coverSize + config.spacing)) + 2;
    
    // Create a grid that extends beyond the visible area
    const totalImagesNeeded = imagesNeededForWidth * imagesNeededForHeight;
    
    // If we don't have enough unique images, we'll need to duplicate some
    if (albumCovers.length < totalImagesNeeded) {
        const originalLength = albumCovers.length;
        for (let i = 0; i < totalImagesNeeded - originalLength; i++) {
            const sourceIndex = i % originalLength;
            albumCovers.push({
                ...albumCovers[sourceIndex],
                x: 0,
                y: 0
            });
        }
    }

    // Position all images in a grid
    albumCovers.forEach((cover, index) => {
        const col = index % imagesNeededForWidth;
        const row = Math.floor(index / imagesNeededForWidth);
        
        // Start the grid slightly off-screen to ensure smooth wrapping
        cover.x = (col - 1) * (config.coverSize + config.spacing);
        cover.y = (row - 1) * (config.coverSize + config.spacing);
    });
}

let lastTime = 0;
const targetFPS = 60;
const frameInterval = 1000 / targetFPS;

function animate(currentTime = 0) {
    const deltaTime = currentTime - lastTime;
    
    if (deltaTime >= frameInterval) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const effectiveWidth = config.coverSize + config.spacing;
        const effectiveHeight = config.coverSize + config.spacing;
        
        albumCovers.forEach(cover => {
            // Update position
            cover.x += config.direction.x * config.scrollSpeed;
            cover.y += config.direction.y * config.scrollSpeed;

            // Calculate total grid width and height
            const gridWidth = Math.ceil(canvas.width / effectiveWidth) * effectiveWidth;
            const gridHeight = Math.ceil(canvas.height / effectiveHeight) * effectiveHeight;

            // Wrap with perfect alignment
            if (config.direction.x !== 0) {
                if (cover.x >= gridWidth) {
                    cover.x = -effectiveWidth;
                } else if (cover.x < -effectiveWidth) {
                    cover.x = gridWidth - effectiveWidth;
                }
            }

            if (config.direction.y !== 0) {
                if (cover.y >= gridHeight) {
                    cover.y = -effectiveHeight;
                } else if (cover.y < -effectiveHeight) {
                    cover.y = gridHeight - effectiveHeight;
                }
            }

            // Draw the image
            if (cover.image) {
                ctx.save();
                ctx.beginPath();
                ctx.roundRect(cover.x, cover.y, cover.width, cover.height, config.borderRadius);
                ctx.clip();
                ctx.drawImage(cover.image, cover.x, cover.y, cover.width, cover.height);
                ctx.restore();
            }
        });

        lastTime = currentTime;
    }

    requestAnimationFrame(animate);
}

// Start the application
init(); 