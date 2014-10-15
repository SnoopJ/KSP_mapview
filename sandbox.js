// ugly hack
var MAXDIST = 1e10;
var EPS = 1e-10;

var th = THREE;
var parent, renderer, scene, camera, controls, pivot1, pivot2, pivot3, stats, gui;

var line,sphere,refdir,refplane,orbit,parentbody;

// with thanks to Abtin Forouzandeh of StackOverflow
// http://stackoverflow.com/a/25153614
function webglAvailable() {
    try {
        var canvas = document.createElement("canvas");
        return !!
            window.WebGLRenderingContext && 
            (canvas.getContext("webgl") || 
                canvas.getContext("experimental-webgl"));
    } catch(e) { 
        return false;
    } 
}

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
    orbit.e = 0.3;
    orbit.sma = 3;
    orbit.inc = Math.PI*1/6;
    orbit.laan = Math.PI*0/2;
    orbit.argp = Math.PI*1/4;
    orbit.grav = 50;

    orbit.nu = 0;

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
    orbit.animate = true;

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
    info.innerHTML = 'Drag your cursor to rotate camera';
    document.body.appendChild(info);
    // renderer
    //renderer = new th.CanvasRenderer();
    //renderer = new th.WebGLRenderer({antialias:true, preserveDrawingBuffer: true});
    renderer = webglAvailable() ? new THREE.WebGLRenderer({antialias: true, preserveDrawingBuffer:true}) : new THREE.CanvasRenderer();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.physicallyBasedShading = true;
    document.body.appendChild(renderer.domElement);

    stats = new Stats();
    stats.domElement.style.position = 'absolute';
    stats.domElement.style.left = '0px';
    stats.domElement.style.top = '0px';
    document.body.appendChild( stats.domElement );
    
    gui = new dat.GUI({width: 500});
    gui.add( orbit, 'e' ).min(0).max(5).step(0.01).name("Eccentricity").onChange( updateOrbit ); 
    gui.add( orbit, 'incdeg' ).min(0).max(180).step(1).name("Inclination (deg)").onChange( updateOrbit );
    gui.add( orbit, 'argpdeg' ).min(0).max(360).step(1).name("Argument of Periapsis (deg)").onChange( updateOrbit );
    gui.add( orbit, 'sma' ).min(1).max(10).name("Semi-major axis").onChange( updateOrbit );
    gui.add( orbit, 'laandeg').min(0).max(360).step(1).name("Longitude of Ascending Node (deg)").onChange(updateOrbit);
    gui.add( orbit, 'grav').min(0.5).max(200).name("Gravitational parameter (arbitrary units)").onChange(updateOrbit);
    gui.add( parentbody.position, 'x' ).min(-5).max(5).name("Parent x").onChange( updateOrbit );
    gui.add( parentbody.position, 'y' ).min(-5).max(5).name("Parent y").onChange( updateOrbit );
    gui.add( parentbody.position, 'z' ).min(-5).max(5).name("Parent z").onChange( updateOrbit );
    gui.add( orbit, 'animate' ).listen().name("Animate orbit?").onChange( updateOrbit );
    //gui.add( orbit, 'nudeg').min(0).max(360).listen().name("True Anomaly (deg)").onChange( setNu );
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
    sphere.add(m);
//    scene.add(m)

    // this is somehow necessary for the applyMatrix to work?!
    // TODO: fix horrifying kludge
    //renderer.render(scene, camera);

    //m.position.add( sphere.position );
    m.position.copy( orbit.curve.getPoint(Math.PI/2, true) );
    m.position.applyMatrix4( orbit.rotMatrix );

}

// "typical" frame dt in s
var dt = 16e-3;

function animate() {
    requestAnimationFrame(animate);
    controls.update();

    if (orbit.animate || orbit.manual ) {
	    var inv = (new th.Matrix4).getInverse(orbit.rotMatrix);
	    var rvec = m.position.clone().applyMatrix4(inv);
	    r = rvec.length();
	    var ang = Math.atan2(rvec.z, rvec.x);
	    // Kepler's second law, yo
	    delta = ( 1/(r*r) * 2 * Math.PI * orbit.sma*orbit.sma * ( orbit.e < 1 ? Math.sqrt( 1- orbit.e*orbit.e) : 1 ) ) * dt / Math.pow(orbit.sma * 4*Math.PI*Math.PI/orbit.grav,2/3);
	    // TODO: embed this minus sign in getPoint or elsewhere?
	    ang -= delta;
	    // shit don't work
	    if ( orbit.animate ) { orbit.nu = ( ang<0 ? Math.PI : 0)-ang; orbit.nudeg = orbit.nu*180/Math.PI; }
	    ang = ang%(2*Math.PI);
	    m.position.copy( orbit.curve.getPoint( orbit.manual? -orbit.nu : ang, true ));
	    m.position.applyMatrix4( orbit.rotMatrix );
    }

    renderer.render(scene, camera);
    stats.update()

}

// Why doesn't javascript have this?!
Math.clamp = function(a,min,max) { return ( a<min ? min : ( a>max ? max : a ) ); }

orbitinit();
init();
animate();

