// ugly hack
var MAXDIST = 1e10;
var EPS = 1e-10;

var th = THREE;
var parent, renderer, scene, camera, controls, pivot1, pivot2, pivot3, stats, gui;

var line,sphere,refdir,refplane,orbit,parentbody;
var matu = {type:'f', value:0 }
var tubemat = new th.ShaderMaterial({
	  uniforms: { amplitude: matu 
	    ,color: {type:'c', value: new th.Color( 0xffffff ) } 
            ,a: {type:'f', value: 1.0 }
	  }
	  ,vertexShader: document.getElementById( 'vertexShader' ).textContent
	  ,fragmentShader: document.getElementById( 'fragmentShader' ).textContent
	  ,transparent: true
          
	})

// Default to 3s resolution
var defaultRate=3000
var defaultUrl="ws://localhost:8085/datalink"
//var defaultUrl="ws://echo.websocket.org"
//var defaultUrl="ws://192.168.1.2:8085/datalink"
function TMhandler(m) { 
	var data = JSON.parse(m.data); if(!isEmpty(data)) { 
		orbit.e = data["o.eccentricity"] ? data["o.eccentricity"] : orbit.e; 
		orbit.inc = data["o.inclination"] ? data["o.inclination"]*Math.PI/180 : orbit.inc;
		orbit.argp = data["o.argumentOfPeriapsis"] ? data["o.argumentOfPeriapsis"] *Math.PI/180 : orbit.argp;
		orbit.sma = data["o.sma"] ? data["o.sma"] : orbit.sma;
		orbit.lan = data["o.lan"] ? data["o.lan"]*Math.PI/180 : orbit.lan;
		orbit.nu = data["o.trueAnomaly"] ? data["o.trueAnomaly"]*Math.PI/180 : orbit.nu;
		orbit.period = data["o.period"] ? data["o.period"] : orbit.period;
		orbit.t = m.timeStamp;
		orbit.updated = true;
		updateOrbit() 
	} 
} 

//var ws = openSocket(defaultUrl,TMhandler);
//setTimeout( sendCmd( {rate:defaultRate} ), 2000)
//subscribe( "o.eccentricity", "o.inclination", "o.argumentOfPeriapsis", "o.sma", "o.lan", "o.trueAnomaly", "o.period", "t.timeWarp" )

// debug, emulate Telemachus responses
var fakeit = false;
var projector = new th.Projector();
var globalscale = 1e-6;

function onMouseDown(e) {
    mouseDown = true;
    //e.preventDefault();
  if (e.button != 2) return;
    //if ( e.button == 2 ) { // R-click
//	window.open( renderer.domElement.toDataURL("image/png"), "Final");	
  mouseVector = new THREE.Vector3();
  mouseVector.x = 2 * (e.clientX / window.innerWidth ) - 1;
  mouseVector.y = 1 - 2 * ( e.clientY / window.innerHeight );
  mouseVector.z = 0.1

  var end = new th.Vector3(); end.copy(mouseVector); end.z = -1.0;

  //raycaster = projector.pickingRay( mouseVector, camera );
  projector.unprojectVector(mouseVector,camera)
  var org = origin = camera.position
  raycaster = new th.Raycaster(org,mouseVector.sub(camera.position).normalize(),0,1e10)

 // scene.add(new th.ArrowHelper( mouseVector.normalize(), camera.position, 1e5, 0xff0000 ))
  var intersects = raycaster.intersectObjects( clickhelp.children, true );
    if (intersects[0]){
    //intersects[0].object.realobj.material.uniforms.color.value = new th.Color( 0xffffff* Math.random() )
    selectOrbit(intersects[0])
      }
//}
}
    document.addEventListener('mousedown', onMouseDown, false);

var selectedOrbit;
function selectOrbit(o) {
    if (selectedOrbit) selectedOrbit.material.uniforms.color.value = new th.Color( 0xffffff )
    selectedOrbit = o.object.realobj
    selectedOrbit.material.uniforms.color.value = new th.Color( 0xff0000 )
}

var kerbolsys;
function orbitinit() {
    parentbody = new Object();
    parentbody.position = new th.Vector3(5, 2, 1);
    parentbody.refnml = new th.Vector3(0, 1, 0);
    parentbody.refdir = new th.Vector3(1, 0, 0);
    
    orbit = new Object();
    orbit.parent = parentbody;

    // orbital elements
    orbit.e = 0.3;
    orbit.sma = 90e4;
    orbit.inc = Math.PI*1/6;
    orbit.laan = Math.PI*0/2;
    orbit.argp = Math.PI*1/4;
    orbit.grav = 50;

    orbit.nu = 0;
    orbit.period = 1;

    // TODO: use this to get true anomaly at epoch? not a huge deal really since Telemachus reports true anomaly
    orbit.mae = 0.0;
    
    // derived quantities
    orbit.apo = orbit.sma*(1-orbit.e);
    orbit.pe = orbit.sma*(1+orbit.e);

    // these are for control by GUI ONLY!
    orbit.incdeg = orbit.inc*180/Math.PI;
    orbit.laandeg = orbit.laan*180/Math.PI;
    orbit.argpdeg = orbit.argp*180/Math.PI;
    orbit.nudeg = orbit.nu*180/Math.PI;
    orbit.animate = false;

    system = new th.Object3D()
    clickhelp = new th.Object3D()

    $.getJSON("kerbolsys.json", function(j) { JSONtoOrbit(j) })
}

function JSONtoOrbit(j,p){
  for (var i=0; i<j.length; i++) {
    var o = j[i]
    o.parent = parentbody
    o.sma *= globalscale
    o.e = o.eccentricity
    o.inc = 2*Math.PI/180*o.inclination
    o.laan = 2*Math.PI/180*o.longitudeOfAscendingNode
    o.argp = 2*Math.PI/180*o.argumentOfPeriapsis
    tmat = tubemat.clone()
    tmat.uniforms.amplitude = matu
    var orb = makeOrbit( o, tmat )
    var sph = new th.Mesh(new th.SphereGeometry(o.bodysize*globalscale,32,32))
    sph.name = o.name
    sph.renderDepth = 1
    sph.position.copy( orb.curve.getPoint(Math.PI/2,true) )
    //sph.applyMatrix( orb.matrix )
    orb.add(sph)
    if (p) { p.add(orb) } else { system.add( orb ) }
    g = orb.geometry
    g.parameters.radius *= 15
    var hlp = new th.Mesh( new th.TubeGeometry( g.parameters.path, g.segments, g.parameters.radius, g.parameters.radialSegments ) )
    hlp.rotation.copy( orb.rotation )
    hlp.position.copy( orb.parent.position )
    hlp.realobj = orb
    clickhelp.add( hlp )

    if (j[i].children) { JSONtoOrbit(j[i].children,sph) }

  }

}
function makeOrbit(o,mat) {
	// Create the THREE.Line associated with an orbit
	var pt = function(t,isAngle) { 
			// t: 0 -> 1
			// theta: -pi -> pi (for elliptical)
			var theta=[];
			theta = theta.concat(t);
			if (!isAngle) {
			  theta = theta.map(function(t){ return (2*t-1)*(o.e <= 1 ? Math.PI : Math.acos(-1/o.e)-EPS);});
			}
			var r = theta.map( function(theta){ return Math.max(Math.abs(o.sma*(1-o.e*o.e)),2*o.sma*o.e)/(1+o.e*Math.cos(theta))} );
			// ew.
			//r = r.map( function(r){ return Math.min(r,MAXDIST);});
			var val = r.map( function(r,i){ return new th.Vector3( 
			  r*Math.cos(theta[i]), 
			  0,
			  r*Math.sin(theta[i]) );} ); 
			val = val.length>1 ? val : val[0];
			return val;
	};
	var curve = new (th.Curve.create( function(){}, pt ));
	var geo = new th.Geometry();
	// TODO: Less arbitrary sampling?	
	var a=[]; for(i=0; i<=200; i++){ a[i] = 2*(i-100)/200*( o.e<=1 ? 2*Math.PI : Math.acos(-1/o.e)-EPS) ; }
	geo.vertices = geo.vertices.concat( curve.getPoint( a, true ) );
	o.curve = curve;

	var orb;
	// material optional
	// if (mat) { orb = new th.Line(geo,mat); } else { orb = new th.Line(geo); }
        orb = new th.Mesh( new th.TubeGeometry( curve, 100, o.bodysize/10*globalscale, 10 ) )
	console.log("generated "+orb.geometry.vertices.length+" vertices in one orbit ("+o.name+")")
 	if (mat) { orb.material = mat }

	// transform to be correct relative to parent
	var m = (new th.Matrix4).identity();
    	m.multiply( (new th.Matrix4).makeRotationAxis( o.parent.refnml, o.laan ) ) ;
    	m.multiply( (new th.Matrix4).makeRotationAxis( o.parent.refdir, o.inc ));
    	m.multiply( (new th.Matrix4).makeRotationAxis( o.parent.refnml, o.argp ));

	// store this matrix with the orbit, we'll need it again
	orbit.rotMatrix = m;
        orb.curve = curve;
    	orb.setRotationFromMatrix(m);
	return orb;
}

var setNu = function() { orbit.animate = false; updateOrbit(); }
var updateOrbit = function(){ 

	orbit.inc = orbit.incdeg*Math.PI/180;
	orbit.argp = orbit.argpdeg*Math.PI/180;
	orbit.laan = orbit.laandeg*Math.PI/180;
	orbit.nu = orbit.nudeg*Math.PI/180;
	orbit.manual = !orbit.animate;

	sphere.position.copy( parentbody.position ); 
	sphere.remove(line); 
	line = makeOrbit(orbit,line.material); 
	sphere.add(line)  
};

function init() {

    // info
    info = document.createElement('div');
    info.style.position = 'absolute';
    info.style.top = '30px';
    info.style.width = '100%';
    info.style.textAlign = 'center';
    info.style.color = '#fff';
    info.style.fontWeight = 'bold';
    info.style.backgroundColor = 'transparent';
    info.style.zIndex = '1';
    info.style.fontFamily = 'Monospace';
    info.innerHTML = 'Drag your cursor to rotate camera<BR>Skybox by Rareden';
    document.body.appendChild(info);
    // renderer
    //renderer = new th.CanvasRenderer();
    //renderer = new th.WebGLRenderer({antialias:true, preserveDrawingBuffer: true});
    renderer = webglAvailable() ? new THREE.WebGLRenderer({antialias: true, preserveDrawingBuffer:true}) : new THREE.CanvasRenderer();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.physicallyBasedShading = true;
    document.body.appendChild(renderer.domElement);

    window.onresize = (function() { 
	renderer.setSize(window.innerWidth, window.innerHeight);
	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();
    });

    stats = new Stats();
    stats.domElement.style.position = 'absolute';
    stats.domElement.style.left = '0px';
    stats.domElement.style.top = '0px';
    document.body.appendChild( stats.domElement );
    
        // scene
    scene = new th.Scene();
    bgscene = new th.Scene();

    // camera
    camera = new th.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.1, 1e10);
    //camera.position.set(1e8*globalscale, 400e5*globalscale, 0);
    defcamera = camera.position.clone()

    // controls
    // having renderer.domElement here avoids capturing input for dat.GUI 
    controls = new th.OrbitControls(camera, renderer.domElement);
    controls.targetName = "Kerbol"
    controls.zoom = (function(zoomDist) { this.object.position.copy( this.target.clone().sub( this.object.position ).normalize().multiplyScalar( zoomDist ) ) })
    controls.maxDistance = 2e5; controls.minDistance = 1;

    // axes
    //scene.add(new th.AxisHelper(20));
    gui = new dat.GUI({width: 500});
    gui.add( controls, 'targetName', ["Kerbol","Kerbin","Mun","Minmus","Moho","Eve","Duna","Jool","Eeloo"] ).name("Target").onChange( function(n){ t = scene.getObjectByName(n,true); controls.target.copy(t.parent.localToWorld(t.position.clone())) } );
    /*gui.add( orbit, 'e' ).min(0).max(5).step(0.01).listen().name("Eccentricity").onChange( updateOrbit ); 
    gui.add( orbit, 'incdeg' ).min(0).max(180).step(1).listen().name("Inclination (deg)").onChange( updateOrbit );
    gui.add( orbit, 'argpdeg' ).min(0).max(360).step(1).listen().name("Argument of Periapsis (deg)").onChange( updateOrbit );
    gui.add( orbit, 'sma' ).min(1).max(10).listen().name("Semi-major axis").onChange( updateOrbit );
    gui.add( orbit, 'laandeg').min(0).max(360).step(1).listen().name("Longitude of Ascending Node (deg)").onChange(updateOrbit);
    gui.add( orbit, 'grav').min(0.5).max(200).listen().name("Gravitational parameter (arbitrary units)").onChange(updateOrbit);
    gui.add( parentbody.position, 'x' ).min(-5).max(5).listen().name("Parent x").onChange( updateOrbit );
    gui.add( parentbody.position, 'y' ).min(-5).max(5).listen().name("Parent y").onChange( updateOrbit );
    gui.add( parentbody.position, 'z' ).min(-5).max(5).name("Parent z").onChange( updateOrbit );
    gui.add( orbit, 'animate' ).listen().name("Animate orbit?").onChange( updateOrbit );
    gui.close()*/
    //gui.add( orbit, 'nudeg').min(0).max(360).listen().name("True Anomaly (deg)").onChange( setNu );

  var urls = [ 
    'img/rareden/Skybox_PositiveX.jpg'
    ,'img/rareden/Skybox_NegativeX.jpg'
    ,'img/rareden/Skybox_PositiveY.jpg'
    ,'img/rareden/Skybox_NegativeY.jpg'
    ,'img/rareden/Skybox_PositiveZ.jpg'
    ,'img/rareden/Skybox_NegativeZ.jpg'
  ]
  
  cubemap = th.ImageUtils.loadTextureCube(urls)
  cubemap.format = THREE.RGBFormat;
  shader = th.ShaderLib.cube
  shader.uniforms.tCube.value = cubemap
var cubemat = new THREE.ShaderMaterial( {
  fragmentShader: shader.fragmentShader,
  vertexShader: shader.vertexShader,
  uniforms: shader.uniforms,
  depthWrite: false,
  depthTest: false,
  side: THREE.BackSide
});
  //cubemat.side = th.BackSide
  cubegeo = new th.BoxGeometry( 1e11, 1e11, 1e11 )
  cube = new th.Mesh(cubegeo,cubemat)
  cube.renderDepth = -1
  scene.add(cube)
            
    var material = new th.LineBasicMaterial({
        color: 0xFFFFFF,
        opacity: 1,
	linewidth: 1e3
    });

    line = makeOrbit(orbit,material);
    
    /*var m = (new th.Matrix4).identity();
    m.multiply( (new th.Matrix4).makeRotationAxis( parentbody.refnml, orbit.lan ) ) ;
    m.multiply( (new th.Matrix4).makeRotationAxis( 
	//parentbody.refdir.clone().cross(parentbody.refnml.clone()), 
	parentbody.refdir,
	orbit.inc ));
    m.multiply( (new th.Matrix4).makeRotationAxis( parentbody.refnml, orbit.argp ));
    line.setRotationFromMatrix(m);*/

    var geometry = new th.SphereGeometry(globalscale*261e6, 16, 16);
    //geometry.z = 10;
    var spherematerial = new th.MeshBasicMaterial({
        color: 0xffff00,
	wireframe: true
    });
    sphere = new th.Mesh(geometry, spherematerial);
    sphere.name = "Kerbol"

    //sphere.add(line);
    sphere.add(system);
    // since clickhelp never gets rendered, this is needed for raycasting
    scene.add(sphere);
    
    //var arrow = new th.ArrowHelper( parentbody.refdir, new th.Vector3(0,0,0), 5, 0x00ff00 );
    //var uparrow = new th.ArrowHelper( parentbody.refnml, new th.Vector3(0,0,0), 5, 0xff00ff );
    //sphere.add(arrow);
    //sphere.add(uparrow); 
	
    var s = new th.SphereGeometry(5,16,16);
    m = new th.Mesh(s,material);
    sphere.add(m);
//    scene.add(m)

    // this is somehow necessary for the applyMatrix to work?!
    // TODO: fix horrifying kludge
    //renderer.render(scene, camera);

    //m.position.add( sphere.position );
    m.position.copy( orbit.curve.getPoint(Math.PI/2, true) );
    m.position.applyMatrix4( orbit.rotMatrix );

    camera.position.set( 1e8, 1e5, 0 )
    //camera.position.copy( controls.target.clone().sub( camera.position ).normalize().multiplyScalar(1e4) )

}

// "typical" frame dt in s
var dt = 16e-3;

function animate() {
    requestAnimationFrame(animate);
    controls.update();

    /*if (orbit.animate) {
	    var inv = (new th.Matrix4).getInverse(orbit.rotMatrix);
	    var rvec = m.position.clone().applyMatrix4(inv);
	    r = rvec.length();
	    var ang = Math.atan2(rvec.z, rvec.x);
	    // Kepler's second law, yo
	    delta = ( 1/(r*r) * 2 * Math.PI * orbit.sma*orbit.sma * ( orbit.e < 1 ? Math.sqrt( 1- orbit.e*orbit.e) : 1 ) ) * dt / Math.pow(orbit.sma * 4*Math.PI*Math.PI/orbit.grav,2/3);
	    // TODO: embed this minus sign in getPoint or elsewhere?
	    ang -= delta;
	    // shit don't work
	    //if ( orbit.animate ) { orbit.nu = ( ang<0 ? Math.PI : 0)-ang; orbit.nudeg = orbit.nu*180/Math.PI; }
	    ang = ang%(2*Math.PI);
    } else {
	    ang = -orbit.nu;	
	    // would like to interpolate, t.timeWarp is broken in Telemachus
	    //ang = -orbit.nu - (Date.now()-orbit.timeStamp)/1000*orbit.timewarp*2*Math.PI/orbit.period;
    }

    m.position.copy( orbit.curve.getPoint( ang, true ));
    m.position.applyMatrix4( orbit.rotMatrix );*/

    
    var dist = camera.position.clone().sub(controls.target).length()
    matu.value = Math.pow(dist,1.1)/1e3
    renderer.render(scene, camera);
    clickhelp.updateMatrixWorld();
    stats.update()

}

// Why doesn't javascript have this?!
Math.clamp = function(a,min,max) { return ( a<min ? min : ( a>max ? max : a ) ); }

orbitinit();
init();
animate();
