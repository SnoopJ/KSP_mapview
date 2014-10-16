// debug, emulate Telemachus responses
var fakeit = true;

function isEmpty(o) {
    if (!(o instanceof Object)) { console.warn("isEmpty was given non-object input"); return }
    for (e in o) return false
    return true
}
    
function openSocket(url) { 
    var ws = new WebSocket(url);
    ws.onmessage = (function(m) { var data = JSON.parse(m.data); if(!isEmpty(data)) { console.log(data) } })
    ws.onclose = (function() { console.log("WebSocket closed!") })
    ws.isopen = (function() { return this.readyState == this.OPEN } )
    return ws
}

var telemachus = {
	rate : 2000
	,subs : []
	,update : (function(){ 
		var response = { data: [] }
		for( var i=0, l=subs.length; i < l; i++ ) { 
			response.data[subs[i]] = this[subs[i]]
			ws.onmessage( response )
		} 
		})
	,o : {
		relativeVelocity: Math.random()*70000
		,PeA: Math.random()*70000
		,ApA: Math.random()*70000
		,timeToAp: Math.random()*500
		,timeToPe: Math.random()*600
		,inclination: Math.random()*2*Math.PI
		,eccentricity: Math.random()*70000
		,epoch: Math.random()*500
		,period: Math.random()*1200
		,argumentOfPeriapsis: Math.random()*600
		,timeToTransition1: Math.random()*600
		,timeToTransition2: Math.random()*600
		,sma: Math.random()*70000
		,lan: Math.random()*2*Math.PI
		,maae: Math.random()*2*Math.PI
		,timeOfPeriapsisPassage: Math.random()*600
		,trueAnomaly: Math.random()*2*Math.PI
	}
}

function emulateTelemachus(cmd,ws) {
	cmd = JSON.parse(cmd);
	if (!isEmpty(cmd.data)) {
		ws.onmessage( telemachus.update() )
	}
}

function sendCmd(cmd) { 
    if (!ws || !ws.isopen()){
	ws = openSocket(defaultUrl)
    	if (fakeit) {
	  emulateTelemachus(cmd,ws) 
	  return 
	} else {
	  setTimeout(function(){ws.send(JSON.stringify(cmd))},1000)
	}
    } else {
	ws.send(JSON.stringify(cmd))
    }
}

function subscribe() {
    var sublist = [];
    for (var i=0; i<arguments.length; i++) sublist.push(arguments[i])
    if (sublist.length > 0)
	sendCmd( { "+" : sublist } ) 
    else
	throw "Nothing to subscribe to!"
}

function unsubscribe() {
    var sublist = [];
    for (var i=0; i<arguments.length; i++) sublist.push(arguments[i])
    if (sublist.length > 0)
	sendCmd( { "-" : sublist } ) 
    else
	throw "Nothing to unsubscribe from!"
}  


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
