// Spotify API configuration
const SPOTIFY_CLIENT_ID = '524ea17d26f64c1dbd8ba951ce483297'; // Replace this with your actual Client ID from Spotify Developer Dashboard
const SPOTIFY_REDIRECT_URI = 'http://localhost:3000/callback';
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
    // Calculate how many images needed to fill screen width plus one extra for smooth wrapping
    const imagesNeededForWidth = Math.ceil(canvas.width / config.coverSize) + 1;
    const imagesNeededForHeight = Math.ceil(canvas.height / config.coverSize) + 1;
    
    // Create grid of images
    albumCovers.forEach((cover, index) => {
        const col = index % imagesNeededForWidth;
        const row = Math.floor(index / imagesNeededForWidth) % imagesNeededForHeight;
        
        cover.x = col * (config.coverSize + config.spacing);
        cover.y = row * (config.coverSize + config.spacing);
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
        
        // Calculate diagonal speed for buffer
        const speed = Math.sqrt(
            Math.pow(config.direction.x * config.scrollSpeed, 2) + 
            Math.pow(config.direction.y * config.scrollSpeed, 2)
        );
        
        // Adjust buffer based on movement speed and direction
        const renderBuffer = Math.max(effectiveWidth, effectiveHeight) + speed * 10;

        albumCovers.forEach(cover => {
            // Update position
            cover.x += config.direction.x * config.scrollSpeed;
            cover.y += config.direction.y * config.scrollSpeed;

            // Calculate wrapped positions
            let wrappedX = cover.x;
            let wrappedY = cover.y;

            // Horizontal wrapping
            if (config.direction.x !== 0) {
                if (wrappedX > canvas.width) {
                    wrappedX = wrappedX - Math.ceil(wrappedX / effectiveWidth) * effectiveWidth;
                } else if (wrappedX < -effectiveWidth) {
                    wrappedX = canvas.width - (Math.abs(wrappedX) % effectiveWidth);
                }
            }

            // Vertical wrapping
            if (config.direction.y !== 0) {
                if (wrappedY > canvas.height) {
                    wrappedY = wrappedY - Math.ceil(wrappedY / effectiveHeight) * effectiveHeight;
                } else if (wrappedY < -effectiveHeight) {
                    wrappedY = canvas.height - (Math.abs(wrappedY) % effectiveHeight);
                }
            }

            // Update positions with wrapped values
            cover.x = wrappedX;
            cover.y = wrappedY;

            // Calculate the distance from the edge of the viewport
            const distanceFromEdge = Math.min(
                Math.abs(cover.x + effectiveWidth),
                Math.abs(cover.x - canvas.width),
                Math.abs(cover.y + effectiveHeight),
                Math.abs(cover.y - canvas.height)
            );

            // Extended render area with dynamic buffer
            if (cover.image && 
                cover.x + effectiveWidth >= -renderBuffer && 
                cover.x <= canvas.width + renderBuffer && 
                cover.y + effectiveHeight >= -renderBuffer && 
                cover.y <= canvas.height + renderBuffer) {
                
                // Draw rounded rectangle
                ctx.save();
                ctx.beginPath();
                ctx.roundRect(cover.x, cover.y, cover.width, cover.height, config.borderRadius);
                ctx.clip();

                // Draw image with fade effect near edges
                if (distanceFromEdge < renderBuffer) {
                    ctx.globalAlpha = 1;
                }
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