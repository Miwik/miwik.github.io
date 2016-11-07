// BUGS:
// - ERROR after some time:
//   Cannot enlarge memory arrays. Either
//   (1) compile with  -s TOTAL_MEMORY=X  with X higher than the current value 67108864,
//   (2) compile with  -s ALLOW_MEMORY_GROWTH=1  which adjusts the size at runtime but prevents some optimizations,
//   (3) set Module.TOTAL_MEMORY to a higher value before the program runs, or if you want malloc to
//   return NULL (0) instead of this abort, compile with  -s ABORTING_MALLOC=0

var m = {};
var container;

class CPhysicsBox {

  constructor(v, q, size = 1.0) {
    this.origin = {};
    this.smoothToOrigin = false;
    this.setOrigin(v, q);
    this._size = size;

    // graphics, we don't care about the mesh transforms; it will be updated through its physical body
    var randomColor = getRandomInt(0x050505, 0xffffff);
    var material = new THREE.MeshPhongMaterial({ color: randomColor, specular: 0x2f2f2f, shininess: 10, transparent: true, opacity: 0.75, shading: THREE.FlatShading });
    this.mesh = new THREE.Mesh(new THREE.BoxGeometry(size, size, size), material);

    // physics
    this.setTransform(v, new THREE.Quaternion());
  }

  setOrigin(v, q = new THREE.Quaternion()) {
    this.origin.v = v;
    this.origin.q = q;
  }

  // cannot directly "teleport" the physics object: remove it from physics world and recreate it at the new position
  setTransform(v, q) {
    m.scene.world.removeRigidBody(this.body);
    this.body = {}; // delete? body, is it necessary?

    var mass = this._size * this._size * this._size;
    var startTransform = new Ammo.btTransform();
    startTransform.setIdentity();
    startTransform.setOrigin(new Ammo.btVector3(v.x, v.y, v.z));
    startTransform.setRotation(new Ammo.btQuaternion(q.x, q.y, q.z, q.w));

    var localInertia = new Ammo.btVector3(0, 0, 0);

    var boxShape = new Ammo.btBoxShape(new Ammo.btVector3(this._size / 2.0, this._size / 2.0, this._size / 2.0));
    boxShape.calculateLocalInertia(mass, localInertia);

    var motionState = new Ammo.btDefaultMotionState(startTransform);
    var rbInfo = new Ammo.btRigidBodyConstructionInfo(mass, motionState, boxShape, localInertia);
    this.body = new Ammo.btRigidBody(rbInfo);

    m.scene.world.addRigidBody(this.body);
  }

  toggleSmoothToOrigin() {
    this.smoothToOrigin = !this.smoothToOrigin;
    if (this.smoothToOrigin === false) {
      this.setTransform(this.mesh.position, this.mesh.quaternion);
    }
  }

  update(delta = 0, speed = 0) {
    // we don't smooth to origin, update the mesh to its physical body position and orientation
    if (!this.smoothToOrigin) {
      var transform = new Ammo.btTransform();
      this.body.getMotionState().getWorldTransform(transform);

      var origin = transform.getOrigin();
      // limit fall
      if (origin.y() < -200) {
        this.body.setActivationState(0);
      }
      var rotation = transform.getRotation();
      this.mesh.position.set(origin.x(), origin.y(), origin.z());
      this.mesh.quaternion.set(rotation.x(), rotation.y(), rotation.z(), rotation.w());
    }

    // smooth mesh position and orientation to origin, don't touch the physical body, it will be set to the
    // mesh position when smooth it toggled off
    else {
      this.mesh.position.lerp(this.origin.v, delta * speed);
      this.mesh.quaternion.slerp(this.origin.q, delta * speed);
    }
  }
}

window.onload = RockNRoll();

function RockNRoll() {
  initGraphics();
  initPhysicsWorld();
  createScene();
  render();
}

// Create the renderer, scene and camera
function initGraphics() {
  // Get the size of the inner window (content area)
  // Reduce the canvas size a little bit to prevent scrolling the whole window
  m.widthBorder = 10;
  m.heightBorder = 20;

  var canvasWidth = window.innerWidth - m.widthBorder;
  var canvasHeight = window.innerHeight - m.heightBorder;

  m.renderer = new THREE.WebGLRenderer({ antialias: true });
  m.renderer.setSize(canvasWidth, canvasHeight);
  // Set the background color of the renderer to black, with full opacity
  // m.renderer.setClearColor(0x353538, 1);
  m.renderer.setClearColor(0xffffff, 1);

  document.body.appendChild(m.renderer.domElement);

  m.clock = new THREE.Clock();

  m.scene = new THREE.Scene();
  m.camera = new THREE.PerspectiveCamera(75, canvasWidth / canvasHeight, 0.1, 1000);

  // lights
  var ambient = new THREE.AmbientLight(0x404040); // soft white light
  m.scene.add(ambient);

  var light = new THREE.DirectionalLight(0xffffff, 1); // default white light
  light.position.set(0, 1, 1);
  m.scene.add(light);

  // Add a listener for 'keydown' events. By this listener, all key events will be
  // passed to the function 'onDocumentKeyDown'. There's another event type 'keypress'.
  // It will report only the visible characters like 'a', but not the function keys
  // like 'cursor up'.
  document.addEventListener("keydown", onDocumentKeyDown, false);
  document.addEventListener("keyup", onDocumentKeyUp, false);

  window.addEventListener("resize", onWindowResize, false);

  // Used to remember wich keys are pressed and disable the key repeat
  m.keys = [];
}

function initPhysicsWorld() {
  var collisionConfiguration = new Ammo.btDefaultCollisionConfiguration();
  var dispatcher = new Ammo.btCollisionDispatcher(collisionConfiguration);
  var overlappingPairCache = new Ammo.btDbvtBroadphase();
  var solver = new Ammo.btSequentialImpulseConstraintSolver();
  m.scene.world = new Ammo.btDiscreteDynamicsWorld(dispatcher, overlappingPairCache, solver, collisionConfiguration);
  m.scene.world.setGravity(new Ammo.btVector3(0, -12, 0));
}

function getRandomInt(min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min)) + min;
}

function createScene() {
  // graphics: plane
  var geometry = new THREE.PlaneGeometry(25, 25, 25, 25);
  var material = new THREE.MeshBasicMaterial({ color: 0x101010, side: THREE.DoubleSide, wireframe: true });
  m.plane = new THREE.Mesh(geometry, material);
  m.plane.rotation.x = THREE.Math.degToRad(90);
  m.scene.add(m.plane);

  // physics: plane - ground
  var groundShape = new Ammo.btBoxShape(new Ammo.btVector3(12.5, 1, 12.5)); // Create block 50x2x50
  var groundTransform = new Ammo.btTransform();
  groundTransform.setIdentity();
  groundTransform.setOrigin(new Ammo.btVector3(0, -1, 0)); // Set initial position

  var groundMass = 0; // Mass of 0 means ground won't move from gravity or collisions
  var localInertia = new Ammo.btVector3(0, 0, 0);
  var motionState = new Ammo.btDefaultMotionState(groundTransform);
  var rbInfo = new Ammo.btRigidBodyConstructionInfo(groundMass, motionState, groundShape, localInertia);
  var groundAmmo = new Ammo.btRigidBody(rbInfo);
  m.scene.world.addRigidBody(groundAmmo);

  // create boxes
  var sideNum = 10;
  var startPosRange = 75;
  var startOriRange = Math.PI;
  m.boxes = [];
  for (x = 0; x < sideNum; x++) {
    for (y = 0; y < sideNum; y++) {
      for (z = 0; z < sideNum; z++) {
        // original box position
        var physicsbox = new CPhysicsBox(new THREE.Vector3((x - sideNum / 2) * 1.5, y * 1.5 + 5, (z - sideNum / 2) * 1.5), new THREE.Quaternion());

        // move the box to a random position and orientation
        physicsbox.mesh.position.set(
          getRandomInt(-startPosRange, startPosRange),
          getRandomInt(-startPosRange, startPosRange),
          getRandomInt(-startPosRange, startPosRange));

        physicsbox.mesh.quaternion.setFromEuler(new THREE.Euler(
          getRandomInt(-startOriRange, startOriRange),
          getRandomInt(-startOriRange, startOriRange),
          getRandomInt(-startOriRange, startOriRange), 'XYZ'));

        physicsbox.toggleSmoothToOrigin();

        m.boxes.push(physicsbox);
        m.scene.add(physicsbox.mesh);
      }
    }
  }

  // move camera
  m.camera.position.set(0, 17, 25);
  m.camera.lookAt(new THREE.Vector3(0, 5, 0));

  // stats
  container = document.createElement('div');
  document.body.appendChild(container);

  m.stats = new Stats();
  container.appendChild(m.stats.dom);

  // display some help
  var info = document.createElement('div');
  info.style.position = 'absolute';
  info.style.top = '10px';
  info.style.width = '100%';
  info.style.textAlign = 'center';
  info.innerHTML = 'Space: toggle group / physicalize objects';
  container.appendChild(info);
}

function animate(delta) {
  // update physics when not smoothing boxes
  if (!m.sto) {
    m.scene.world.stepSimulation(delta * 1.5, 5);
  }

  // NOT A FUNCTION? DAFUQ?!
  //
  // for (box in m.boxes) {
  //   box.update(delta, 1.5);
  // }

  // WORKING but could be smaller
  //
  // for (i = 0; i < m.boxes.length; i++) {
  //   m.boxes[i].update(delta, 1.5);
  // }

  // OK super intuitive and readable foreach...
  //
  m.boxes.forEach(function(box) { box.update(delta, 1.5 ); });
}

function onDocumentKeyDown(event) {
  // Disable key repeat
  if (m.keys[event.keyCode] === true) {
    return;
  }

  console.log("keydown " + event.keyCode);

  // to body: setLinearVelocity / applyForce / applyImpulse
  m.keys[event.keyCode] = true;
  switch (event.keyCode) {
    // space key
    case 32:
      m.boxes.forEach(function(box) { box.toggleSmoothToOrigin(); });
      break;
  }
}

function onDocumentKeyUp(event) {
  console.log("keyup" + event.keyCode);
  m.keys[event.keyCode] = false;
}

function onWindowResize() {
  var canvasWidth = window.innerWidth - m.widthBorder;
  var canvasHeight = window.innerHeight - m.heightBorder;

  m.camera.aspect = canvasWidth / canvasHeight;
  m.camera.updateProjectionMatrix();

  m.renderer.setSize(canvasWidth, canvasHeight);
}

// Render the scene. Map the 3D world to the 2D screen.
function render() {
  // This will create a loop that causes the renderer to draw the scene 60 times per second.
  // If you're new to writing games in the browser, you might say "why don't we just create a setInterval?
  // The thing is - we could, but requestAnimationFrame has a number of advantages.
  // Perhaps the most important one is that it pauses when the user navigates to another browser tab,
  // hence not wasting their precious processing power and battery life.
  requestAnimationFrame(render);

  m.stats.begin();
  var delta = m.clock.getDelta();
  animate(delta);
  m.renderer.render(m.scene, m.camera);
  m.stats.end();
}
