const canvas = document.querySelector('#gl-canvas');
const gl = canvas.getContext('webgl');

if (!gl) {
    alert('WebGL not supported!');
}

// Object to store normalized or raw mouse coordinates
const mouse = { x: 0, y: 0 };

// Track mouse movement (mapping WebGL's bottom-left origin)
window.addEventListener('mousemove', (e) => {
    mouse.x = e.clientX;
    // Invert Y because browser coordinates start at top-left, WebGL starts at bottom-left
    mouse.y = window.innerHeight - e.clientY;
});

// Resize canvas to match display size
function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    gl.viewport(0, 0, canvas.width, canvas.height);
}
window.addEventListener('resize', resize);
resize();

// Vertex shader: simple full-quad position pass
const vsSource = `
    attribute vec2 a_position;
    void main() {
        gl_Position = vec4(a_position, 0.0, 1.0);
    }
`;

// Fragment shader: uses u_resolution, u_time, and u_mouse
const fsSource = `
    precision mediump float;
uniform vec2 u_resolution;
uniform vec2 u_mouse;
uniform float u_time;

// Normalize mouse coordinates (0.0 to 1.0)
vec2 normMouse = u_mouse / u_resolution;

// Vector between mouseposition and screen
//vec2 mousePos = 1.0/u_resolution - normMouse;

vec2 random2( vec2 p ) {
    return fract(sin(vec2(dot(p,vec2(127.1,311.7)),dot(p,vec2(269.5,183.3))))*43758.5453);
}

#define PI 3.1415926535897932384626433832795

//this is a basic Pseudo Random Number Generator
float hash(in float n)
{
    return fract(sin(n)*48.5453123);
}

void main() {
    vec2 st = gl_FragCoord.xy/u_resolution.xy;
    st.x *= u_resolution.x/u_resolution.y;
    vec3 color = vec3(0.406,0.541,1.000);

    // Scale
    st *= 5.;
    
    // variables
    float mouseDiff;
	vec2 point;

    // Tile the space
    vec2 i_st = floor(st);
    vec2 f_st = fract(st);

    float m_dist = 1.0;  // minimum distance

    for (int y= -1; y <= 1; y++) {
        for (int x= -1; x <= 1; x++) {
            // Neighbor place in the grid
            vec2 neighbor = vec2(float(x),float(y));

            // Random position from current + neighbor place in the grid
            vec2 point = random2(i_st + neighbor);
            
            //gets a 'random' angle around the center 
        	//float angle = sin( u_time * PI * .00001 ) - hash(u_mouse.x) * PI * 2.;
            
            //creates a temporary 2d vector
    		//vec2 temp = vec2( u_mouse.x + cos( angle ) * 0.1, u_mouse.y + sin( angle ) * 0.1 );
            
            float mouseDiff = length(point - normMouse);

			// Animate the point
            point = 0.2 + (0.5 + 0.5*sin(u_time + 6.2831*point));// -temp*0.01;

			// Vector between the pixel and the point
            vec2 diff = neighbor + point - f_st;

            // Distance to the point
            float dist = length(diff/mouseDiff*0.5);
            
            if (mouseDiff < 0.2) {
                m_dist = min(m_dist, dist);
            }
            else {
                // Keep the closer distance
                m_dist = min(m_dist, dist);
            }
        }
    }
    
    // Draw the min distance (distance field)
    color -= smoothstep(m_dist, 1.0, 0.8);

    // Draw cell center
    //color += 1.-step(.05, m_dist);

    // Draw grid
    //color.r += step(.98, f_st.x) + step(.98, f_st.y);

    // Show isolines
    color += step(.7,abs(sin(60.0*m_dist)))*.05;
    color -= smoothstep(0.0, 1.0, 0.2);

    gl_FragColor = vec4(color,1.0);
}
`;

// Helper function to compile shaders
function createShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error(gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
    }
    return shader;
}

const vertexShader = createShader(gl, gl.VERTEX_SHADER, vsSource);
const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fsSource);

// Link program
const program = gl.createProgram();
gl.attachShader(program, vertexShader);
gl.attachShader(program, fragmentShader);
gl.linkProgram(program);
gl.useProgram(program);

// Set up rectangle geometry covering the screen (two triangles)
const positionBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
const positions = new Float32Array([
    -1, -1,
        1, -1,
    -1,  1,
    -1,  1,
        1, -1,
        1,  1,
]);
gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

const positionLocation = gl.getAttribLocation(program, "a_position");
gl.enableVertexAttribArray(positionLocation);
gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

// Get uniform locations
const resolutionLocation = gl.getUniformLocation(program, "u_resolution");
const timeLocation = gl.getUniformLocation(program, "u_time");
const mouseLocation = gl.getUniformLocation(program, "u_mouse");

// Render loop
let startTime = Date.now();
function render() {
    let currentTime = (Date.now() - startTime) * 0.001;

    // Pass uniform data to shader
    gl.uniform2f(resolutionLocation, canvas.width, canvas.height);
    gl.uniform1f(timeLocation, currentTime);
    gl.uniform2f(mouseLocation, mouse.x, mouse.y);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
    requestAnimationFrame(render);
}
render();