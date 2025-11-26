// Configuration
const CONFIG = {
    text: 'GrowthLab',
    color: 0xffffff,
    maxRotation: 0.4,       // More dramatic rotation (~23 degrees)
    lerpFactor: 0.08,
    textDepth: 25,
    fontSize: 70,
    fontUrl: 'fonts/ShareTechMono_Regular.typeface.json',
    // Lighting settings - using high intensity with decay=0 for stylized look
    // (Three.js r155+ uses physically correct lighting which requires high values at distance)
    spotlightColor: 0x7AA966,  // Brand green
    spotlightIntensity: 500,   // Balanced for bloom effect
    ambientIntensity: 0.35     // Reasonable fill light
};

// State
let THREE, FontLoader, TextGeometry, EffectComposer, RenderPass, UnrealBloomPass, ShaderPass;
let scene, camera, renderer, composer, textMesh, groundPlane, container;
let targetRotationX = 0;
let targetRotationY = 0;
let currentRotationX = 0;
let currentRotationY = 0;
let mouseX = 0;
let mouseY = 0;

// Glitch effect state
let raycaster, mouseVec;
let glitchIntensity = 0;
let glitchTargetIntensity = 0;
let chromaticPass;
let textMaterial;      // Front face material (for emissive animation)
let sideMaterial;      // Side/extrusion material (darker for depth)
const GLITCH_CONFIG = {
    maxIntensity: 0.6,      // Medium intensity
    lerpIn: 0.12,           // Speed of glitch activation
    lerpOut: 0.06,          // Speed of glitch decay (slower for lingering effect)
    rgbOffset: 0.008,       // Base RGB separation amount
    scanlineChance: 0.15,   // Probability of scanline displacement per frame
    scanlineOffset: 0.02,   // Max scanline displacement
    // Emissive pulse settings
    emissiveBase: 0.06,     // Base emissive intensity (idle state)
    emissiveMax: 0.2,       // Max emissive intensity (hover state)
    emissivePulseSpeed: 8,  // Speed of pulsing variation
    emissivePulseAmount: 0.06 // Amount of pulsing variation
};

// Chromatic Aberration + Scanline Glitch Shader (localized to cursor)
const ChromaticAberrationShader = {
    uniforms: {
        tDiffuse: { value: null },
        amount: { value: 0.0 },
        time: { value: 0.0 },
        resolution: { value: null },
        hoverPoint: { value: null },  // Screen-space hover position (0-1)
        falloffRadius: { value: 0.3 } // How far the effect spreads
    },
    vertexShader: `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float amount;
        uniform float time;
        uniform vec2 resolution;
        uniform vec2 hoverPoint;
        uniform float falloffRadius;
        varying vec2 vUv;

        // Pseudo-random function
        float random(vec2 st) {
            return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
        }

        void main() {
            vec2 uv = vUv;

            // Skip processing if no glitch active
            if (amount < 0.001) {
                gl_FragColor = texture2D(tDiffuse, uv);
                return;
            }

            // Calculate distance from hover point with aspect ratio correction
            vec2 aspectCorrect = vec2(resolution.x / resolution.y, 1.0);
            float dist = distance(uv * aspectCorrect, hoverPoint * aspectCorrect);

            // Smooth falloff from hover point - intensity peaks at cursor
            float localIntensity = amount * smoothstep(falloffRadius, 0.0, dist);

            // Skip if too far from hover point
            if (localIntensity < 0.001) {
                gl_FragColor = texture2D(tDiffuse, uv);
                return;
            }

            // Time-based noise for organic variation
            float noiseX = (random(vec2(time, uv.y)) - 0.5) * 2.0;

            // Scanline displacement - horizontal tears (localized)
            float scanlineNoise = random(vec2(floor(uv.y * 100.0), time));
            float scanlineDisplace = 0.0;
            if (scanlineNoise > (1.0 - 0.2 * localIntensity)) {
                scanlineDisplace = (random(vec2(time, floor(uv.y * 100.0))) - 0.5) * 0.05 * localIntensity;
            }

            // RGB channel separation - stronger near cursor
            float offset = localIntensity * 0.012 * (1.0 + noiseX * 0.5);

            // Add subtle vertical wave distortion
            float wave = sin(uv.y * 50.0 + time * 10.0) * 0.0015 * localIntensity;

            vec2 rOffset = vec2(offset + wave + scanlineDisplace, 0.0);
            vec2 bOffset = vec2(-offset - wave + scanlineDisplace, 0.0);

            // Sample each channel with offset
            float r = texture2D(tDiffuse, uv + rOffset).r;
            float g = texture2D(tDiffuse, uv + vec2(scanlineDisplace, 0.0)).g;
            float b = texture2D(tDiffuse, uv + bOffset).b;
            float a = texture2D(tDiffuse, uv).a;

            // Slight brightness flicker (localized)
            float flicker = 1.0 + (random(vec2(time * 5.0, 0.0)) - 0.5) * 0.06 * localIntensity;

            gl_FragColor = vec4(r * flicker, g * flicker, b * flicker, a);
        }
    `
};

// Lazy load Three.js and initialize
async function loadAndInit() {
    container = document.getElementById('canvas-container');
    if (!container) return;

    // Dynamic imports - load Three.js and post-processing
    const [
        threeModule,
        fontLoaderModule,
        textGeometryModule,
        effectComposerModule,
        renderPassModule,
        bloomPassModule,
        shaderPassModule
    ] = await Promise.all([
        import('three'),
        import('three/addons/loaders/FontLoader.js'),
        import('three/addons/geometries/TextGeometry.js'),
        import('three/addons/postprocessing/EffectComposer.js'),
        import('three/addons/postprocessing/RenderPass.js'),
        import('three/addons/postprocessing/UnrealBloomPass.js'),
        import('three/addons/postprocessing/ShaderPass.js')
    ]);

    THREE = threeModule;
    FontLoader = fontLoaderModule.FontLoader;
    TextGeometry = textGeometryModule.TextGeometry;
    EffectComposer = effectComposerModule.EffectComposer;
    RenderPass = renderPassModule.RenderPass;
    UnrealBloomPass = bloomPassModule.UnrealBloomPass;
    ShaderPass = shaderPassModule.ShaderPass;

    init();
}

function init() {
    // Scene
    scene = new THREE.Scene();

    // Camera
    camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 1, 2000);
    camera.position.z = 400;

    // Raycaster for hover detection
    raycaster = new THREE.Raycaster();
    mouseVec = new THREE.Vector2();

    // Renderer - transparent to blend with CSS background
    renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    // Lighting - Dramatic spotlight effect
    // Hemisphere light for natural fill (sky/ground)
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, CONFIG.ambientIntensity);
    hemiLight.position.set(0, 200, 0);
    scene.add(hemiLight);

    // Main spotlight from above-front with brand green tint
    const spotlight = new THREE.SpotLight(CONFIG.spotlightColor, CONFIG.spotlightIntensity);
    spotlight.position.set(0, 250, 350);
    spotlight.angle = Math.PI / 4;       // 45 degree cone
    spotlight.penumbra = 0.5;            // Soft edges
    spotlight.decay = 0;                 // No distance falloff (stylized, not physical)
    spotlight.distance = 0;              // Infinite distance
    spotlight.castShadow = true;
    spotlight.shadow.mapSize.width = 2048;
    spotlight.shadow.mapSize.height = 2048;
    spotlight.shadow.camera.near = 50;
    spotlight.shadow.camera.far = 800;
    spotlight.shadow.bias = -0.0005;
    scene.add(spotlight);

    // Spotlight target at text center
    const spotlightTarget = new THREE.Object3D();
    spotlightTarget.position.set(0, 0, 0);
    scene.add(spotlightTarget);
    spotlight.target = spotlightTarget;

    // Secondary white light from opposite side for rim lighting
    const rimLight = new THREE.DirectionalLight(0xffffff, 0.6);
    rimLight.position.set(-150, 50, -100);
    scene.add(rimLight);

    // Skip ground plane - use CSS for floor glow effect instead
    // This keeps the 3D text crisp against pure darkness
    groundPlane = null;

    // Post-processing for bloom/glow effect
    composer = new EffectComposer(renderer);

    const renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);

    // Very subtle bloom - just softens edges slightly
    // Main CRT glow effect done via CSS for crisp text
    const bloomPass = new UnrealBloomPass(
        new THREE.Vector2(window.innerWidth, window.innerHeight),
        0.08,   // very subtle
        0.2,    // tight radius
        0.92    // high threshold - only brightest pixels
    );
    composer.addPass(bloomPass);

    // Chromatic aberration glitch pass (triggered on hover)
    chromaticPass = new ShaderPass(ChromaticAberrationShader);
    chromaticPass.uniforms.resolution.value = new THREE.Vector2(window.innerWidth, window.innerHeight);
    chromaticPass.uniforms.hoverPoint.value = new THREE.Vector2(0.5, 0.5);
    composer.addPass(chromaticPass);

    // Load font and create text
    const loader = new FontLoader();
    loader.load(CONFIG.fontUrl, (font) => {
        createText(font);
        // Mark canvas as loaded for CSS fade-in
        container.classList.add('loaded');
        animate();
    });

    // Event listeners
    window.addEventListener('resize', onWindowResize);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchstart', onTouchMove, { passive: true });
}

function createText(font) {
    const geometry = new TextGeometry(CONFIG.text, {
        font: font,
        size: CONFIG.fontSize,
        height: CONFIG.textDepth,  // TextGeometry uses 'height' not 'depth'
        curveSegments: 12,
        bevelEnabled: true,
        bevelThickness: 0.5,
        bevelSize: 0.4,
        bevelOffset: 0,
        bevelSegments: 5
    });

    geometry.computeBoundingBox();
    const centerOffset = new THREE.Vector3();
    geometry.boundingBox.getCenter(centerOffset);
    geometry.translate(-centerOffset.x, -centerOffset.y, -centerOffset.z);

    // Front/back face material - bright with emissive glow
    textMaterial = new THREE.MeshStandardMaterial({
        color: CONFIG.color,
        metalness: 0.05,
        roughness: 0.4,
        emissive: 0x5a8a56,
        emissiveIntensity: GLITCH_CONFIG.emissiveBase
    });

    // Side/extrusion material - much darker for strong depth contrast
    sideMaterial = new THREE.MeshStandardMaterial({
        color: 0x333333,          // Very dark gray
        metalness: 0.0,
        roughness: 0.95,          // Very rough - minimal specular
        emissive: 0x0a1a08,       // Very dark green, almost black
        emissiveIntensity: 0.01   // Barely visible glow
    });

    // TextGeometry uses [frontMaterial, sideMaterial]
    textMesh = new THREE.Mesh(geometry, [textMaterial, sideMaterial]);
    textMesh.castShadow = true;
    textMesh.receiveShadow = true;
    scene.add(textMesh);
    adjustCameraForViewport();
}

function adjustCameraForViewport() {
    if (!textMesh) return;

    const bbox = textMesh.geometry.boundingBox;
    const textWidth = bbox.max.x - bbox.min.x;
    const textHeight = bbox.max.y - bbox.min.y;

    const padding = 1.4;
    const fov = camera.fov * (Math.PI / 180);
    const aspect = window.innerWidth / window.innerHeight;

    const distanceForWidth = (textWidth * padding) / (2 * Math.tan(fov / 2) * aspect);
    const distanceForHeight = (textHeight * padding) / (2 * Math.tan(fov / 2));

    camera.position.z = Math.max(distanceForWidth, distanceForHeight);
    // Slight upward offset (negative Y moves camera down, text appears higher)
    camera.position.y = -camera.position.z * 0.1;
}

function onWindowResize() {
    if (!camera || !renderer) return;
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    if (composer) {
        composer.setSize(window.innerWidth, window.innerHeight);
    }
    if (chromaticPass) {
        chromaticPass.uniforms.resolution.value.set(window.innerWidth, window.innerHeight);
    }
    adjustCameraForViewport();
}

function onMouseMove(event) {
    mouseX = (event.clientX / window.innerWidth) * 2 - 1;
    mouseY = (event.clientY / window.innerHeight) * 2 - 1;
    // Update mouseVec for raycasting (note: Y is inverted for Three.js)
    mouseVec.x = mouseX;
    mouseVec.y = -mouseY;
    updateTargetRotation();
}

function onTouchMove(event) {
    if (event.touches.length > 0) {
        const touch = event.touches[0];
        mouseX = (touch.clientX / window.innerWidth) * 2 - 1;
        mouseY = (touch.clientY / window.innerHeight) * 2 - 1;
        // Update mouseVec for raycasting
        mouseVec.x = mouseX;
        mouseVec.y = -mouseY;
        updateTargetRotation();
    }
}

function updateTargetRotation() {
    targetRotationY = mouseX * CONFIG.maxRotation;
    targetRotationX = -mouseY * CONFIG.maxRotation;
}

function animate() {
    requestAnimationFrame(animate);

    if (textMesh) {
        currentRotationX += (targetRotationX - currentRotationX) * CONFIG.lerpFactor;
        currentRotationY += (targetRotationY - currentRotationY) * CONFIG.lerpFactor;
        textMesh.rotation.x = currentRotationX;
        textMesh.rotation.y = currentRotationY;

        // Raycasting for hover detection
        raycaster.setFromCamera(mouseVec, camera);
        const intersects = raycaster.intersectObject(textMesh);

        // Update glitch target based on intersection
        if (intersects.length > 0) {
            glitchTargetIntensity = GLITCH_CONFIG.maxIntensity;
        } else {
            glitchTargetIntensity = 0;
        }

        // Smooth lerp to target intensity (faster in, slower out)
        const lerpFactor = glitchTargetIntensity > glitchIntensity
            ? GLITCH_CONFIG.lerpIn
            : GLITCH_CONFIG.lerpOut;
        glitchIntensity += (glitchTargetIntensity - glitchIntensity) * lerpFactor;

        // Update shader uniforms
        if (chromaticPass) {
            chromaticPass.uniforms.amount.value = glitchIntensity;
            chromaticPass.uniforms.time.value = performance.now() * 0.001;
            // Convert mouse position from NDC (-1 to 1) to UV (0 to 1)
            // Note: Y is flipped because UV origin is bottom-left
            chromaticPass.uniforms.hoverPoint.value.set(
                (mouseX + 1) / 2,
                (1 - mouseY) / 2
            );
        }

        // Update emissive pulse
        if (textMaterial) {
            const time = performance.now() * 0.001;
            // Calculate target emissive based on glitch intensity
            const emissiveTarget = GLITCH_CONFIG.emissiveBase +
                (GLITCH_CONFIG.emissiveMax - GLITCH_CONFIG.emissiveBase) * glitchIntensity;
            // Add pulsing variation when hovering
            const pulse = Math.sin(time * GLITCH_CONFIG.emissivePulseSpeed) *
                GLITCH_CONFIG.emissivePulseAmount * glitchIntensity;
            textMaterial.emissiveIntensity = emissiveTarget + pulse;
        }
    }

    // Render with post-processing (bloom + glitch)
    composer.render();
}

// Cleanup
window.addEventListener('beforeunload', () => {
    if (renderer) renderer.dispose();
    if (textMesh) {
        textMesh.geometry.dispose();
    }
    if (textMaterial) textMaterial.dispose();
    if (sideMaterial) sideMaterial.dispose();
    if (groundPlane) {
        groundPlane.geometry.dispose();
        groundPlane.material.dispose();
    }
});

// Start loading after page is interactive (non-blocking)
if ('requestIdleCallback' in window) {
    requestIdleCallback(() => loadAndInit(), { timeout: 200 });
} else {
    setTimeout(loadAndInit, 0);
}
