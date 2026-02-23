/**
 * Portfolio Module
 * Handles rendering and interaction for the portfolio page
 */
(function() {
    'use strict';

    let observer = null;
    let cleanupListeners = [];
    let lightboxElement = null;

    /**
     * Detect if device supports touch
     */
    function isTouchDevice() {
        return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    }

    /**
     * Determine aspect category from dimensions
     * Order matters - check widest ratio first
     */
    function getAspectCategory(width, height) {
        const ratio = width / height;
        if (ratio > 2.5) return 'banner';     // Very wide (check FIRST)
        if (ratio > 1.5) return 'landscape';  // Wide (16:9)
        if (ratio < 0.7) return 'portrait';   // Tall (9:16)
        return 'square';                       // ~1:1
    }

    /**
     * Create fullscreen SVG icon
     */
    function createFullscreenIcon() {
        return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
        </svg>`;
    }

    /**
     * Create play SVG icon
     */
    function createPlayIcon() {
        return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
            <polygon points="5,3 19,12 5,21"/>
        </svg>`;
    }

    /**
     * Request fullscreen for video element
     */
    function requestFullscreen(video) {
        if (video.requestFullscreen) {
            video.requestFullscreen();
        } else if (video.webkitRequestFullscreen) {
            video.webkitRequestFullscreen();
        } else if (video.webkitEnterFullscreen) {
            // iOS Safari
            video.webkitEnterFullscreen();
        }
    }

    /**
     * Create lightbox for images
     */
    function setupLightbox() {
        if (lightboxElement) return;

        const lightbox = document.createElement('div');
        lightbox.className = 'image-lightbox';

        const img = document.createElement('img');
        img.alt = 'Fullscreen image';

        const closeBtn = document.createElement('button');
        closeBtn.className = 'image-lightbox-close';
        closeBtn.innerHTML = '&times;';
        closeBtn.setAttribute('aria-label', 'Close lightbox');

        lightbox.appendChild(img);
        lightbox.appendChild(closeBtn);
        document.body.appendChild(lightbox);
        lightboxElement = lightbox;

        let currentImages = [];
        let currentImageIndex = 0;

        function closeLightbox() {
            lightbox.classList.remove('visible');
            currentImages = [];
            currentImageIndex = 0;
        }

        function openLightbox(src, imageIndex, images) {
            img.src = src;
            img.style.width = '';
            img.style.height = '';

            if (images) {
                currentImages = images;
                currentImageIndex = imageIndex || 0;
            }

            img.onload = () => {
                const naturalW = img.naturalWidth;
                const naturalH = img.naturalHeight;
                const viewportW = window.innerWidth;
                const viewportH = window.innerHeight;

                const minScale = 0.75;
                const maxScale = 0.90;

                const scaleToFitW = (viewportW * minScale) / naturalW;
                const scaleToFitH = (viewportH * minScale) / naturalH;
                const scaleUp = Math.min(scaleToFitW, scaleToFitH);

                if (scaleUp > 1) {
                    const maxW = viewportW * maxScale;
                    const maxH = viewportH * maxScale;
                    const finalW = Math.min(naturalW * scaleUp, maxW);
                    const finalH = Math.min(naturalH * scaleUp, maxH);

                    img.style.width = `${finalW}px`;
                    img.style.height = `${finalH}px`;
                }
            };

            lightbox.classList.add('visible');
        }

        function navigateImage(direction) {
            if (currentImages.length <= 1) return;

            if (direction === 'next') {
                currentImageIndex = (currentImageIndex + 1) % currentImages.length;
            } else {
                currentImageIndex = (currentImageIndex - 1 + currentImages.length) % currentImages.length;
            }

            const newSrc = currentImages[currentImageIndex].src || currentImages[currentImageIndex].dataset.src;
            img.src = newSrc;
            img.style.width = '';
            img.style.height = '';
        }

        const closeHandler = (e) => {
            e.stopPropagation();
            closeLightbox();
        };
        closeBtn.addEventListener('click', closeHandler);

        const overlayHandler = (e) => {
            if (e.target === lightbox) {
                closeLightbox();
            }
        };
        lightbox.addEventListener('click', overlayHandler);

        const keyHandler = (e) => {
            if (!lightbox.classList.contains('visible')) return;

            if (e.key === 'Escape') {
                closeLightbox();
            } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                navigateImage('next');
            } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                navigateImage('prev');
            }
        };
        document.addEventListener('keydown', keyHandler);

        cleanupListeners.push(() => {
            closeBtn.removeEventListener('click', closeHandler);
            lightbox.removeEventListener('click', overlayHandler);
            document.removeEventListener('keydown', keyHandler);
        });

        return { openLightbox, closeLightbox };
    }

    /**
     * Create a portfolio item element
     */
    function createPortfolioItem(item, lightbox) {
        const div = document.createElement('div');
        div.className = 'portfolio-item';
        const aspect = getAspectCategory(item.width, item.height);
        div.setAttribute('data-aspect', aspect);

        if (item.type === 'video') {
            div.classList.add('portfolio-item-video');

            const video = document.createElement('video');
            video.setAttribute('data-src', item.src);
            video.setAttribute('poster', item.poster);
            video.setAttribute('width', item.width);
            video.setAttribute('height', item.height);
            // Set as properties for reliable behavior
            video.loop = true;
            video.muted = true;
            video.playsInline = true;
            video.preload = 'none';
            video.alt = item.alt || '';

            // Add WebM and MP4 sources
            const webmSrc = item.src;
            const mp4Src = item.src.replace('.webm', '.mp4');

            const sourceWebm = document.createElement('source');
            sourceWebm.setAttribute('data-src', webmSrc);
            sourceWebm.setAttribute('type', 'video/webm');

            const sourceMp4 = document.createElement('source');
            sourceMp4.setAttribute('data-src', mp4Src);
            sourceMp4.setAttribute('type', 'video/mp4');

            video.appendChild(sourceWebm);
            video.appendChild(sourceMp4);
            div.appendChild(video);

            // Play indicator
            const playIndicator = document.createElement('div');
            playIndicator.className = 'portfolio-play-indicator';
            playIndicator.innerHTML = createPlayIcon();
            div.appendChild(playIndicator);

            // Fullscreen button
            const fullscreenBtn = document.createElement('button');
            fullscreenBtn.className = 'portfolio-fullscreen-btn';
            fullscreenBtn.innerHTML = createFullscreenIcon();
            fullscreenBtn.setAttribute('aria-label', 'Fullscreen video');
            div.appendChild(fullscreenBtn);

            // Video interaction handlers
            const isTouch = isTouchDevice();

            if (isTouch) {
                // Touch: tap to toggle play/pause
                const tapHandler = (e) => {
                    if (e.target === fullscreenBtn || fullscreenBtn.contains(e.target)) return;

                    if (video.paused) {
                        video.play();
                        div.classList.add('playing');
                    } else {
                        video.pause();
                        div.classList.remove('playing');
                    }
                };
                div.addEventListener('click', tapHandler);
                cleanupListeners.push(() => div.removeEventListener('click', tapHandler));
            } else {
                // Desktop: hover to play
                const enterHandler = () => {
                    video.play();
                    div.classList.add('playing');
                };
                const leaveHandler = () => {
                    video.pause();
                    div.classList.remove('playing');
                };
                div.addEventListener('mouseenter', enterHandler);
                div.addEventListener('mouseleave', leaveHandler);
                cleanupListeners.push(() => {
                    div.removeEventListener('mouseenter', enterHandler);
                    div.removeEventListener('mouseleave', leaveHandler);
                });
            }

            // Fullscreen button handler - unmute for fullscreen
            const fullscreenHandler = (e) => {
                e.stopPropagation();
                video.muted = false;
                requestFullscreen(video);
            };
            fullscreenBtn.addEventListener('click', fullscreenHandler);
            cleanupListeners.push(() => fullscreenBtn.removeEventListener('click', fullscreenHandler));

            // Re-mute when exiting fullscreen
            const exitFullscreenHandler = () => {
                if (!document.fullscreenElement && !document.webkitFullscreenElement) {
                    video.muted = true;
                }
            };
            document.addEventListener('fullscreenchange', exitFullscreenHandler);
            document.addEventListener('webkitfullscreenchange', exitFullscreenHandler);
            cleanupListeners.push(() => {
                document.removeEventListener('fullscreenchange', exitFullscreenHandler);
                document.removeEventListener('webkitfullscreenchange', exitFullscreenHandler);
            });

        } else {
            // Image item
            const img = document.createElement('img');
            img.setAttribute('data-src', item.src);
            img.setAttribute('width', item.width);
            img.setAttribute('height', item.height);
            img.alt = item.alt || '';
            div.appendChild(img);

            // Click to open lightbox
            const clickHandler = () => {
                const images = Array.from(document.querySelectorAll('.portfolio-item:not(.portfolio-item-video) img'));
                const index = images.indexOf(img);
                lightbox.openLightbox(img.src || img.dataset.src, index, images);
            };
            div.addEventListener('click', clickHandler);
            cleanupListeners.push(() => div.removeEventListener('click', clickHandler));
        }

        return div;
    }

    /**
     * Render a cohort section
     */
    function renderSection(section, lightbox) {
        const sectionEl = document.createElement('section');
        sectionEl.className = 'portfolio-section';
        sectionEl.id = section.id;

        const header = document.createElement('div');
        header.className = 'portfolio-section-header';

        const title = document.createElement('h2');
        title.className = 'portfolio-section-title';
        title.textContent = section.title;
        header.appendChild(title);

        sectionEl.appendChild(header);

        const grid = document.createElement('div');
        grid.className = 'portfolio-grid';

        section.items.forEach(item => {
            const itemEl = createPortfolioItem(item, lightbox);
            grid.appendChild(itemEl);
        });

        sectionEl.appendChild(grid);
        return sectionEl;
    }

    /**
     * Render hero video section
     */
    function renderHero(hero) {
        const section = document.createElement('section');
        section.className = 'portfolio-hero';

        const video = document.createElement('video');
        // Set muted as PROPERTY (not just attribute) - required for autoplay
        video.muted = true;
        video.loop = true;
        video.playsInline = true;
        video.autoplay = true;
        video.preload = 'auto';
        video.setAttribute('poster', hero.poster);
        video.setAttribute('width', hero.width);
        video.setAttribute('height', hero.height);

        // WebM source (primary)
        const sourceWebm = document.createElement('source');
        sourceWebm.src = hero.video;
        sourceWebm.type = 'video/webm';

        // MP4 fallback
        const sourceMp4 = document.createElement('source');
        sourceMp4.src = hero.video.replace('.webm', '.mp4');
        sourceMp4.type = 'video/mp4';

        video.appendChild(sourceWebm);
        video.appendChild(sourceMp4);
        section.appendChild(video);

        // Fullscreen button with audio
        const fullscreenBtn = document.createElement('button');
        fullscreenBtn.className = 'portfolio-hero-fullscreen-btn';
        fullscreenBtn.innerHTML = createFullscreenIcon() + '<span>Watch with audio</span>';
        fullscreenBtn.setAttribute('aria-label', 'Watch fullscreen with audio');
        section.appendChild(fullscreenBtn);

        // Fullscreen handler - unmute and play fullscreen
        const fullscreenHandler = () => {
            video.muted = false;
            video.currentTime = 0;
            requestFullscreen(video);
        };
        fullscreenBtn.addEventListener('click', fullscreenHandler);
        cleanupListeners.push(() => fullscreenBtn.removeEventListener('click', fullscreenHandler));

        // Re-mute when exiting fullscreen
        const exitHandler = () => {
            if (!document.fullscreenElement && !document.webkitFullscreenElement) {
                video.muted = true;
            }
        };
        document.addEventListener('fullscreenchange', exitHandler);
        document.addEventListener('webkitfullscreenchange', exitHandler);
        cleanupListeners.push(() => {
            document.removeEventListener('fullscreenchange', exitHandler);
            document.removeEventListener('webkitfullscreenchange', exitHandler);
        });

        // Explicitly play after a short delay to ensure DOM is ready
        requestAnimationFrame(() => {
            video.play().catch(() => {
                // Autoplay blocked - user interaction required (rare for muted videos)
            });
        });

        return section;
    }

    /**
     * Setup intersection observer for lazy loading
     */
    function setupLazyLoading() {
        const options = {
            root: null,
            rootMargin: '100px',
            threshold: 0
        };

        observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const item = entry.target;

                    // Load images
                    const img = item.querySelector('img[data-src]');
                    if (img && img.dataset.src) {
                        img.src = img.dataset.src;
                        img.removeAttribute('data-src');
                    }

                    // Load video sources
                    const video = item.querySelector('video[data-src]');
                    if (video) {
                        // Set video src from data-src
                        const videoSrc = video.dataset.src;
                        if (videoSrc) {
                            video.src = videoSrc;
                            video.removeAttribute('data-src');
                        }

                        // Load source elements
                        video.querySelectorAll('source[data-src]').forEach(source => {
                            source.src = source.dataset.src;
                            source.removeAttribute('data-src');
                        });

                        video.load();
                    }

                    observer.unobserve(item);
                }
            });
        }, options);

        // Observe all portfolio items
        document.querySelectorAll('.portfolio-item').forEach(item => {
            observer.observe(item);
        });
    }

    /**
     * Main render function
     */
    async function renderPortfolio(container) {
        try {
            // Fetch config
            const response = await fetch('content/portfolio/config.json');
            if (!response.ok) throw new Error('Config not found');
            const config = await response.json();

            // Clear container
            container.innerHTML = '';

            // Create content wrapper
            const content = document.createElement('div');
            content.className = 'portfolio-content';

            // Back button
            const backBtn = document.createElement('a');
            backBtn.href = '/';
            backBtn.className = 'portfolio-back-btn';
            backBtn.innerHTML = '&larr; Back to Cohorts';
            content.appendChild(backBtn);

            // Hero video
            if (config.hero) {
                const hero = renderHero(config.hero);
                content.appendChild(hero);
            }

            // Setup lightbox
            const lightbox = setupLightbox();

            // Render sections
            config.sections.forEach(section => {
                const sectionEl = renderSection(section, lightbox);
                content.appendChild(sectionEl);
            });

            container.appendChild(content);

            // Setup lazy loading after DOM is ready
            requestAnimationFrame(() => {
                setupLazyLoading();
            });

            // Update page title
            document.title = 'GrowthLab - Portfolio';

        } catch (error) {
            console.error('Failed to load portfolio:', error);
            container.innerHTML = `
                <div class="portfolio-content">
                    <a href="/" class="portfolio-back-btn">&larr; Back to Cohorts</a>
                    <p class="error-message">Could not load portfolio. Please try again later.</p>
                </div>
            `;
        }
    }

    /**
     * Cleanup function - must be called when leaving portfolio view
     */
    function cleanup() {
        // Disconnect intersection observer
        if (observer) {
            observer.disconnect();
            observer = null;
        }

        // Pause all videos and release memory
        document.querySelectorAll('.portfolio-item video').forEach(v => {
            v.pause();
            v.removeAttribute('src');
            v.querySelectorAll('source').forEach(s => s.removeAttribute('src'));
            v.load(); // Release memory
        });

        // Remove event listeners
        cleanupListeners.forEach(fn => fn());
        cleanupListeners = [];

        // Remove lightbox if exists
        if (lightboxElement) {
            lightboxElement.remove();
            lightboxElement = null;
        }
    }

    // Export module
    window.portfolioModule = {
        render: renderPortfolio,
        cleanup: cleanup
    };
})();
