// ugly hack
var MAXDIST = 1e10;
var EPS = 1e-10;

var th = THREE;
var parent, renderer, scene, camera, controls, pivot1, pivot2, pivot3, stats, gui;

var line,sphere,refdir,refplane,orbit,parentbody;


function onDocumentMouseDown(event) {
    mouseDown = true;
    event.preventDefault();
    if ( event.button == 2 ) { // R-click
	window.open( renderer.domElement.toDataURL("image/png"), "Final");	
    }
}
    document.addEventListener('mousedown', onDocumentMouseDown, false);

function orbitinit() {
    parentbody = new Object();
    parentbody.position = new th.Vector3(5, 2, 1);
    parentbody.refnml = new th.Vector3(0, 1, 0);
    parentbody.refdir = new th.Vector3(1, 0, 0);
    
    orbit = new Object();
    orbit.parent = parentbody;

    // orbital elements
    orbit.e = 0.8;
    orbit.sma = 1;
    orbit.inc = Math.PI*1/6;
    orbit.laan = Math.PI*0/2;
    orbit.argp = Math.PI*0/4;
    orbit.mae = 0.0;
    
    // derived quantities
    orbit.apo = orbit.sma*(1-orbit.e);
    orbit.pe = orbit.sma*(1+orbit.e);
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
			var r = theta.map( function(theta){ return Math.max(Math.abs(o.sma*(1-o.e^2)),2*o.sma*o.e)/(1+o.e*Math.cos(theta))} );
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
	var a=[]; for(i=0; i<=100; i++){ a[i] = 2*(i-50)/100*( o.e<=1 ? 2*Math.PI : Math.acos(-1/o.e)-EPS) ; }
	geo.vertices = geo.vertices.concat( curve.getPoint( a, true ) );
	o.curve = curve;

	var orb;
	// material optional
	if (mat) { orb = new th.Line(geo,mat); } else { orb = new th.Line(geo); }

	// transform to be correct relative to parent
	var m = (new th.Matrix4).identity();
    	m.multiply( (new th.Matrix4).makeRotationAxis( o.parent.refnml, o.laan ) ) ;
    	m.multiply( (new th.Matrix4).makeRotationAxis( o.parent.refdir, o.inc ));
    	m.multiply( (new th.Matrix4).makeRotationAxis( o.parent.refnml, o.argp ));

	// store this matrix with the orbit, we'll need it again
	orbit.rotMatrix = m;
    	orb.setRotationFromMatrix(m);
	return orb;
}


var updateOrbit = function(){ sphere.position.copy( parentbody.position ); sphere.remove(line); line = makeOrbit(orbit,line.material); sphere.add(line)  };

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
    info.innerHTML = 'Drag your cursor to rotate camera';
    document.body.appendChild(info);
    // renderer
    //renderer = new th.CanvasRenderer();
    renderer = new th.WebGLRenderer({antialias:true, preserveDrawingBuffer: true});
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.physicallyBasedShading = true;
    document.body.appendChild(renderer.domElement);

    stats = new Stats();
    stats.domElement.style.position = 'absolute';
    stats.domElement.style.left = '0px';
    stats.domElement.style.top = '0px';
    document.body.appendChild( stats.domElement );
    
    gui = new dat.GUI();
    gui.add( orbit, 'e' ).name("Eccentricity").min(0).max(5).step(0.01).onChange( updateOrbit ); 
    gui.add( orbit, 'inc' ).name("Inclination").min(0).max(Math.PI).step(Math.PI/50).onChange( updateOrbit );
    gui.add( orbit, 'argp' ).name("Argument of Periapsis").min(0).max(2*Math.PI).step(Math.PI/100).onChange( updateOrbit );
    gui.add( orbit, 'sma' ).name("Semi-major axis").min(1).max(10).onChange( updateOrbit );
    gui.add( orbit, 'laan' ).name("Longitude of Ascending Node").min(0).max(Math.PI*2).onChange( updateOrbit );
    gui.add( parentbody.position, 'x' ).name("Parent x").min(-5).max(5).onChange( updateOrbit );
    gui.add( parentbody.position, 'y' ).name("Parent y").min(-5).max(5).onChange( updateOrbit );
    gui.add( parentbody.position, 'z' ).name("Parent z").min(-5).max(5).onChange( updateOrbit );
    // scene
    scene = new th.Scene();

    // camera
    camera = new th.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(20, 20, 20);

    // controls
    // having renderer.domElement here avoids capturing input for dat.GUI 
    controls = new th.OrbitControls(camera, renderer.domElement);

    // axes
    scene.add(new th.AxisHelper(20));

            
    var material = new th.LineBasicMaterial({
        color: 0xFFFFFF,
        opacity: 1,
	linewidth: 3
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

    var geometry = new th.SphereGeometry(1, 16, 16);
    geometry.z = 10;
    var spherematerial = new th.MeshBasicMaterial({
        color: 0x0000ff,
	wireframe: true
    });
    sphere = new th.Mesh(geometry, spherematerial);
    sphere.position.add(parentbody.position);

    sphere.add(line);
    scene.add(sphere);
    
    var arrow = new th.ArrowHelper( parentbody.refdir, new th.Vector3(0,0,0), 5, 0x00ff00 );
    var uparrow = new th.ArrowHelper( parentbody.refnml, new th.Vector3(0,0,0), 5, 0xff00ff );
    sphere.add(arrow);
    sphere.add(uparrow); 
	
    var s = new th.SphereGeometry(0.5,16,16);
    m = new th.Mesh(s,material);
//    sphere.add(m);
    scene.add(m)

    // this is somehow necessary for the applyMatrix to work?!
    // TODO: fix horrifying kludge
    //renderer.render(scene, camera);

    //m.position.add( sphere.position );
    m.position.add( orbit.curve.getPoint(0.7) );
    m.position.applyMatrix4( orbit.rotMatrix.setPosition(sphere.position) );

}


function animate() {
    requestAnimationFrame(animate);
    controls.update();
    m.position.copy( orbit.curve.getPoint(Date.now()/1000%10*Math.PI*2/10,true));
    //m.position.copy( orbit.curve.getPoint(Math.PI*1/2,true));
    m.position.applyMatrix4( orbit.rotMatrix.setPosition(sphere.position) );

    renderer.render(scene, camera);
    stats.update()

}

orbitinit();
init();
animate();

