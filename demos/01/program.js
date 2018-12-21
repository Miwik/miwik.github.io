var m = {};

window.onload = RockNRoll();

var container;

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

function smoothToOrigin(delta, speed) {
	for (i = 0; i < m.origins.length; i++) {
		m.boxes[i].position.lerp(m.origins[i].position, delta * speed);
		m.boxes[i].quaternion.slerp(m.origins[i].quaternion, delta * speed);
	}
}

function setPhysicsToBoxes() {
	m.bodies.length = m.boxes.length;
	for (i = 0; i < m.boxes.length; i++) {
		var pos = m.boxes[i].position;
		var ori = m.boxes[i].quaternion;

		var body = m.bodies[i];
		m.scene.world.removeRigidBody(body);

		var mass = 1 * 1 * 1; // Matches box dimensions for simplicity
		var startTransform = new Ammo.btTransform();
		startTransform.setIdentity();
		startTransform.setOrigin(new Ammo.btVector3(pos.x, pos.y, pos.z));
		startTransform.setRotation(new Ammo.btQuaternion(ori.x, ori.y, ori.z, ori.w));

		var localInertia = new Ammo.btVector3(0, 0, 0);

		var boxShape = new Ammo.btBoxShape(new Ammo.btVector3(0.5, 0.5, 0.5)); // Box is 1x1x1
		boxShape.calculateLocalInertia(mass, localInertia);

		var motionState = new Ammo.btDefaultMotionState(startTransform);
		var rbInfo = new Ammo.btRigidBodyConstructionInfo(mass, motionState, boxShape, localInertia);
		var boxAmmo = new Ammo.btRigidBody(rbInfo);
		m.scene.world.addRigidBody(boxAmmo);

		m.bodies[i] = boxAmmo;
	}
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
	m.sto = true; // smoothToOrigin toggle

	var sideNum = 10;
	var startPosRange = 75;
	var startOriRange = Math.PI;
	m.origins = [];
	m.boxes = [];
	m.bodies = [];
	for (x = 0; x < sideNum; x++) {
		for (y = 0; y < sideNum; y++) {
			for (z = 0; z < sideNum; z++) {

				// create a node for each cube to store its original position and orientation
				var origin = new THREE.Object3D();
				origin.position.set((x - sideNum / 2) * 1.5, y * 1.5 + 5, (z - sideNum / 2) * 1.5);
				m.origins.push(origin);

				// graphics
				var randomColor = getRandomInt(0x050505, 0xffffff);
				var material = new THREE.MeshPhongMaterial({ color: randomColor, specular: 0x2f2f2f, shininess: 10, transparent: true, opacity: 0.75, shading: THREE.FlatShading });
				var box = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material);
				// box.position = origin.position;
				box.position.x = getRandomInt(-startPosRange, startPosRange);
				box.position.y = getRandomInt(-startPosRange, startPosRange);
				box.position.z = getRandomInt(-startPosRange, startPosRange);
				box.rotation.x = getRandomInt(-startOriRange, startOriRange);
				box.rotation.y = getRandomInt(-startOriRange, startOriRange);
				box.rotation.z = getRandomInt(-startOriRange, startOriRange);
				m.boxes.push(box);
				m.scene.add(box);
			}
		}
	}
	setPhysicsToBoxes();

	// move camera
	m.camera.position.set(0, 17, 25);
	m.camera.lookAt(new THREE.Vector3(0, 5, 0));

	// stats
	container = document.createElement('div');
	document.body.appendChild(container);

	m.stats = new Stats();
	container.appendChild(m.stats.dom);

	// help
	var info = document.createElement('div');
	info.style.position = 'absolute';
	info.style.top = '10px';
	info.style.width = '100%';
	info.style.textAlign = 'center';
	info.innerHTML = 'Space: toggle group / physicalize objects';
	container.appendChild(info);
}

function animate(delta) {
	if (m.sto) {
		smoothToOrigin(delta, 1.5);
	} else {
		// update physics
		m.scene.world.stepSimulation(delta * 1.50, 5);

		var transform = new Ammo.btTransform();
		var origin, rotation;
		for (i = 0; i < m.bodies.length; i++) {
			m.bodies[i].getMotionState().getWorldTransform(transform);
			origin = transform.getOrigin();
			rotation = transform.getRotation();

			if (origin.y() < -100) {
				m.bodies[i].setActivationState(0);
			}

			var box = m.boxes[i];
			box.position.set(origin.x(), origin.y(), origin.z());
			box.quaternion.set(rotation.x(), rotation.y(), rotation.z(), rotation.w());
		}
	}
}

function onDocumentKeyDown(event) {
	// Disable key repeat
	if (m.keys[event.keyCode] === true) {
		return;
	}

	console.log("keydown " + event.keyCode);

	m.keys[event.keyCode] = true;
	switch (event.keyCode) {
		case 32: // space
			m.sto = !m.sto;
			if (m.sto === false) {
				setPhysicsToBoxes();
			}
			break;

		// case 82: // 'r'
		//  	for (i = 0; i < m.bodies.length; i++) {
		// 		// make sure the body is awake
		// 		m.bodies[i].activate();
		// 		// setLineageVelocity / applyForce / applyImpulse
		// 		m.bodies[i].applyImpulse(new Ammo.btVector3(0, 10, 0));
		// 	}
		// 	break;

		// case 38: // up
		// 	for (i = 0; i < m.bodies.length; i++) {
		// 		// make sure the body is awake
		// 		m.bodies[i].activate();
		// 		// setLineageVelocity / applyForce / applyImpulse
		// 		m.bodies[i].applyImpulse(new Ammo.btVector3(getRandomInt(-15, 15), getRandomInt(0, 15), getRandomInt(-15, 15)));
		// 	}
		// 	break;
	}
}

function onDocumentKeyUp(event) {
	console.log("keyup" + event.keyCode);

	m.keys[event.keyCode] = false;
	switch (event.keyCode) {
	}
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
