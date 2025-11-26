// Configuration
const CONFIG = {
    text: 'GrowthLab',
    color: 0xffffff,
    maxRotation: 0.26,
    lerpFactor: 0.08,
    textDepth: 20,
    fontSize: 70,
    fontUrl: 'fonts/ShareTechMono_Regular.typeface.json',
    // Lighting settings - using high intensity with decay=0 for stylized look
    // (Three.js r155+ uses physically correct lighting which requires high values at distance)
    spotlightColor: 0x7AA966,  // Brand green
    spotlightIntensity: 500,   // Balanced for bloom effect
    ambientIntensity: 0.35     // Reasonable fill light
};

// State
let THREE, FontLoader, TextGeometry, EffectComposer, RenderPass, UnrealBloomPass;
let scene, camera, renderer, composer, textMesh, groundPlane, container;
let targetRotationX = 0;
let targetRotationY = 0;
let currentRotationX = 0;
let currentRotationY = 0;
let mouseX = 0;
let mouseY = 0;

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
        bloomPassModule
    ] = await Promise.all([
        import('three'),
        import('three/addons/loaders/FontLoader.js'),
        import('three/addons/geometries/TextGeometry.js'),
        import('three/addons/postprocessing/EffectComposer.js'),
        import('three/addons/postprocessing/RenderPass.js'),
        import('three/addons/postprocessing/UnrealBloomPass.js')
    ]);

    THREE = threeModule;
    FontLoader = fontLoaderModule.FontLoader;
    TextGeometry = textGeometryModule.TextGeometry;
    EffectComposer = effectComposerModule.EffectComposer;
    RenderPass = renderPassModule.RenderPass;
    UnrealBloomPass = bloomPassModule.UnrealBloomPass;

    init();
}

function init() {
    // Scene
    scene = new THREE.Scene();

    // Camera
    camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 1, 2000);
    camera.position.z = 400;

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

    const material = new THREE.MeshStandardMaterial({
        color: CONFIG.color,
        metalness: 0.05,
        roughness: 0.4,
        emissive: 0x5a8a56,       // Subtle green tint
        emissiveIntensity: 0.08   // Very subtle self-illumination
    });

    textMesh = new THREE.Mesh(geometry, material);
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

    // Offset camera Y to center text in visible 60vh area
    const viewportCenter = 0.5;
    const visibleCenter = 0.3;
    const offsetRatio = viewportCenter - visibleCenter;
    const worldHeight = 2 * camera.position.z * Math.tan(fov / 2);
    camera.position.y = -offsetRatio * worldHeight;
}

function onWindowResize() {
    if (!camera || !renderer) return;
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    if (composer) {
        composer.setSize(window.innerWidth, window.innerHeight);
    }
    adjustCameraForViewport();
}

function onMouseMove(event) {
    mouseX = (event.clientX / window.innerWidth) * 2 - 1;
    mouseY = (event.clientY / window.innerHeight) * 2 - 1;
    updateTargetRotation();
}

function onTouchMove(event) {
    if (event.touches.length > 0) {
        const touch = event.touches[0];
        mouseX = (touch.clientX / window.innerWidth) * 2 - 1;
        mouseY = (touch.clientY / window.innerHeight) * 2 - 1;
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
    }

    // Render with post-processing (bloom)
    composer.render();
}

// Cleanup
window.addEventListener('beforeunload', () => {
    if (renderer) renderer.dispose();
    if (textMesh) {
        textMesh.geometry.dispose();
        textMesh.material.dispose();
    }
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
