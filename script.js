import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Capsule } from 'three/examples/jsm/math/Capsule.js';
import { Octree } from 'three/examples/jsm/math/Octree.js';
import { OctreeHelper } from 'three/examples/jsm/helpers/OctreeHelper.js';
import { TextureLoader } from 'three';


const canvas = document.querySelector('canvas.webgl');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x88ccee);
scene.fog = new THREE.Fog(0x88ccee, 0, 50);

const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.rotation.order = 'YXZ';
scene.add(camera);

const renderer = new THREE.WebGLRenderer({
    canvas: canvas,
    antialias: true,
});
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.VSMShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;


// --- Lighting ---
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);

const fillLight = new THREE.DirectionalLight(0xffffff, 0.7);
fillLight.position.set(-10, 10, 5);
scene.add(fillLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
dirLight.position.set(10, 20, 10);
dirLight.castShadow = true;
// --- Shadow Property Adjustments ---
dirLight.shadow.mapSize.width = 512;
dirLight.shadow.mapSize.height = 512;

dirLight.shadow.camera.top = 30;
dirLight.shadow.camera.bottom = -30;
dirLight.shadow.camera.left = -30;
dirLight.shadow.camera.right = 30;
dirLight.shadow.camera.near = 0.1;
dirLight.shadow.camera.far = 200;
scene.add(dirLight);


// --- World & Collision Setup ---
const worldOctree = new Octree();
const loader = new GLTFLoader();

const matcapTexture = new TextureLoader().load('material/images.jpeg');


loader.load(
    'models/map.glb',
    (gltf) => {
        const model = gltf.scene;
        scene.add(model);

        model.traverse(child => {
            if (child.isMesh) {
                console.log('Mesh name:', child.name, '+', child.position);
                if (child.name === 'rock') {
                    child.material = new THREE.MeshMatcapMaterial({ matcap: matcapTexture });
                }
                if (child.name === 'rock001') {
                    child.material = new THREE.MeshMatcapMaterial({ matcap: matcapTexture });
                }
                if (child.name === 'eurica') {
                    child.add(sound)
                }
                child.castShadow = true;
                child.receiveShadow = true;

                if (child.geometry) {
                    worldOctree.fromGraphNode(child);
                }
            }
        });

        // Optional: Visualize the octree for debugging
        // const helper = new OctreeHelper(worldOctree);
        // helper.visible = true;
        // scene.add(helper);

        // Teleport player after the map has loaded
        playerCollider.start.set(0, 1, 0);
        playerCollider.end.set(0, 2, 0);
        playerCollider.radius = 0.5;
        camera.position.copy(playerCollider.end);
        camera.rotation.set(0, 90, 0);

    },
    undefined, // onProgress callback (optional)
    (error) => {
        console.error('An error happened while loading the model:', error);
    }
);


// --- Positional audio --- //
const listener = new THREE.AudioListener();
camera.add( listener );

// create the PositionalAudio object (passing in the listener)
const sound = new THREE.PositionalAudio( listener );

const audioLoader = new THREE.AudioLoader();
audioLoader.load( 
    'sounds/chair.mp3', 
    function( buffer ) {
        sound.setBuffer( buffer );
        sound.setLoop( true );
        sound.setVolume( 2 );
        sound.setRefDistance( 1.0 );
        console.log('Audio loaded successfully');
    }
);

// Audio Recroder
const audioContext = listener.context;
const destination = audioContext.createMediaStreamDestination();

listener.gain.connect(destination);
listener.gain.connect(audioContext.destination);

const mediaRecorder = new MediaRecorder(destination.stream);

let allChunks = [];

function startRecording() {
  if (mediaRecorder.state === 'inactive') {
    allChunks = []; // Clear previous recording
    mediaRecorder.start();
    isRecorderVisible = true; // Show recorder
    console.log('Recording started');
  } else if (mediaRecorder.state === 'paused') {
    mediaRecorder.resume();
    isRecorderVisible = true; // Show recorder
    console.log('Recording resumed');
  } else {
    console.log('Already recording');
  }
}

function stopRecording() {
  if (mediaRecorder.state === 'recording') {
    mediaRecorder.pause();
    isRecorderVisible = false; // Hide recorder
    console.log('Recording paused (still accumulating in same file)');
  } else {
    console.log('Recorder not recording');
  }
}

function finalizeRecording() {
  if (mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
    console.log('Recording stopped (finalized)');
  }
}

function downloadRecording() {
  if (allChunks.length === 0) {
    console.log('No audio data to download');
    return;
  }
  const audioBlob = new Blob(allChunks, { type: 'audio/webm' });
  const audioURL = URL.createObjectURL(audioBlob);

  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = audioURL;
  a.download = 'game-audio.webm';
  document.body.appendChild(a);
  a.click();
  URL.revokeObjectURL(audioURL);

  console.log('Audio downloaded');
}

// Listen for final chunk
mediaRecorder.ondataavailable = (e) => {
  if (e.data.size > 0) {
    allChunks.push(e.data);
  }
};

document.addEventListener('keydown', (e) => {
  if (e.key === 'r') startRecording();       // r: start or resume
  if (e.key === 'p') stopRecording();        // p: pause
  if (e.key === 'f') finalizeRecording();    // f: stop & finalize
  if (e.key === 'g') downloadRecording();    // g: download
});


// --- Player Controller ---
const STEPS_PER_FRAME = 5;
const GRAVITY = 30;

// Player collision capsule
const playerCollider = new Capsule(
        new THREE.Vector3(0, 0.35, 0), 
        new THREE.Vector3(0, 1, 0), 0.35
    );

const playerVelocity = new THREE.Vector3();
const playerDirection = new THREE.Vector3();

let playerOnFloor = false;
let mouseTime = 0;

const keyStates = {};

// --- Walking Variables ---
let bobTime = 0;
const bobFrequency = 5.5; // How many bobs per second
const bobAmplitude = 0.1; // How high the bob goes


// --- Recorder Model Setup ---
let recorderModel = null; // Will hold the loaded GLB model

// Recorder animation state
let isRecorderVisible = false;
let recorderAnimationProgress = 0;
const recorderHiddenPosition = { x: 0.5, y: -2, z: -1 }; // Hidden below view
const recorderVisiblePosition = { x: 0.5, y: -0.5, z: -1 }; // In hand position
const recorderAnimationSpeed = 9; // Speed of show/hide animation

// Load recorder GLB model
loader.load(
    'models/recorder.glb',
    (gltf) => {
        recorderModel = gltf.scene;
        
        // Setup model properties
        recorderModel.traverse(child => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });
        
        // Add to camera and set initial position (hidden)
        camera.add(recorderModel);
        recorderModel.position.set(recorderHiddenPosition.x, recorderHiddenPosition.y, recorderHiddenPosition.z);
        
        // Rotate the model on Z axis
        recorderModel.rotation.z = Math.PI * 0.1; // 18 degrees rotation
        
        console.log('Recorder model loaded successfully');
    },
    undefined, // onProgress callback (optional)
    (error) => {
        console.error('Error loading recorder model:', error);
        // Fallback to cube mesh if model fails to load
    }
);


// --- Event Listeners for Controls ---

// Pointer lock for first-person view
document.addEventListener('mousedown', () => {
    // Resume audio context if suspended
    if (listener.context.state === 'suspended') {
        listener.context.resume();
    }
    
    if (!sound.isPlaying) {
        sound.play();
    }
    document.body.requestPointerLock();
    mouseTime = performance.now();
});

document.body.addEventListener('mousemove', (event) => {
    if (document.pointerLockElement === document.body) {
        camera.rotation.y -= event.movementX / 500;
        camera.rotation.x -= event.movementY / 500;
        // Clamp vertical rotation to prevent flipping
        camera.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, camera.rotation.x));
    }
});

document.addEventListener('keydown', (event) => {
    keyStates[event.code] = true;
});

document.addEventListener('keyup', (event) => {
    keyStates[event.code] = false;
});

window.addEventListener('resize', onWindowResize);

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// --- Game Loop Functions ---

function playerCollisions() {
    const result = worldOctree.capsuleIntersect(playerCollider);
    playerOnFloor = false;

    if (result) {
        playerOnFloor = result.normal.y > 0;
        if (!playerOnFloor) {
            playerVelocity.addScaledVector(result.normal, -result.normal.dot(playerVelocity));
        }
        playerCollider.translate(result.normal.multiplyScalar(result.depth));
    }
}

function updatePlayer(deltaTime) {
    let damping = Math.exp(-4 * deltaTime) - 1;
    if (!playerOnFloor) {
        playerVelocity.y -= GRAVITY * deltaTime;
    }
    playerVelocity.addScaledVector(playerVelocity, damping);
    const deltaPosition = playerVelocity.clone().multiplyScalar(deltaTime);
    playerCollider.translate(deltaPosition);
    playerCollisions();
    camera.position.copy(playerCollider.end);

    // --- Head Bob Logic ---
    const horizontalVelocity = Math.sqrt(playerVelocity.x * playerVelocity.x + playerVelocity.z * playerVelocity.z);
    const bobSpeed = playerOnFloor && horizontalVelocity > 0.1 ? bobFrequency * horizontalVelocity * 0.5 : 0;

    if (bobSpeed > 0) {
        bobTime += deltaTime * bobSpeed;
        const bobOffset = Math.sin(bobTime) * bobAmplitude;
        camera.position.y += bobOffset;
    } else {
        bobTime = 0; // Reset bob
    }
}

function updateRecorderAnimation(deltaTime) {
    if (!recorderModel) return;
    
    // Update animation progress based on visibility state
    if (isRecorderVisible) {
        recorderAnimationProgress = Math.min(1, recorderAnimationProgress + deltaTime * recorderAnimationSpeed);
    } else {
        recorderAnimationProgress = Math.max(0, recorderAnimationProgress - deltaTime * recorderAnimationSpeed);
    }
    
    // Smooth interpolation between hidden and visible positions using easing
    const easeInOut = recorderAnimationProgress < 0.5 
        ? 2 * recorderAnimationProgress * recorderAnimationProgress 
        : 1 - Math.pow(-2 * recorderAnimationProgress + 2, 2) / 2;
    
    // Interpolate position
    recorderModel.position.x = recorderHiddenPosition.x + (recorderVisiblePosition.x - recorderHiddenPosition.x) * easeInOut;
    recorderModel.position.y = recorderHiddenPosition.y + (recorderVisiblePosition.y - recorderHiddenPosition.y) * easeInOut;
    recorderModel.position.z = recorderHiddenPosition.z + (recorderVisiblePosition.z - recorderHiddenPosition.z) * easeInOut;
}


function getForwardVector() {
    camera.getWorldDirection(playerDirection);
    playerDirection.y = 0;
    playerDirection.normalize();
    return playerDirection;
}

function getSideVector() {
    camera.getWorldDirection(playerDirection);
    playerDirection.y = 0;
    playerDirection.normalize();
    playerDirection.cross(camera.up);
    return playerDirection;
}

function controls(deltaTime) {
    // Use a single movement speed for all states
    const speedDelta = deltaTime * 15;

    if (keyStates['KeyW']) {
        playerVelocity.add(getForwardVector().multiplyScalar(speedDelta));
    }
    if (keyStates['KeyS']) {
        playerVelocity.add(getForwardVector().multiplyScalar(-speedDelta));
    }
    if (keyStates['KeyA']) {
        playerVelocity.add(getSideVector().multiplyScalar(-speedDelta));
    }
    if (keyStates['KeyD']) {
        playerVelocity.add(getSideVector().multiplyScalar(speedDelta));
    }
    // if (playerOnFloor) {
    //     if (keyStates['Space']) {
    //         playerVelocity.y = 5;
    //     }
    // }
}

// --- Animation Loop ---
const clock = new THREE.Clock();

function animate() {
    const deltaTime = Math.min(0.05, clock.getDelta()) / STEPS_PER_FRAME;

    //multiple steps per frame to mitigate missing collisions
    for (let i = 0; i < STEPS_PER_FRAME; i++) {
        controls(deltaTime);
        updatePlayer(deltaTime);
    }
    
    // Update recorder animation
    updateRecorderAnimation(deltaTime);

    renderer.render(scene, camera);
    requestAnimationFrame(animate)
}

animate()
