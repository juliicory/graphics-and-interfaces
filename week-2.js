
const canvas = document.querySelector("#gl-canvas");
const gl = canvas.getContext("webgl");

if (!gl) {
    alert("WebGL not supported!");
    throw new Error("WebGL not supported");
}

// Required for dFdx/dFdy in the fragment shader.
if (!gl.getExtension("OES_standard_derivatives")) {
    alert("OES_standard_derivatives not supported!");
    throw new Error("OES_standard_derivatives not supported");
}


// ------------------------------------------------------------
// Mouse
// ------------------------------------------------------------

const mouse = {
    x: 0,
    y: 0,
    down: 0 // Added mouse down state (0 = up, 1 = down)
};

window.addEventListener("mousemove", (e) => {
    mouse.x = e.clientX;
    mouse.y = window.innerHeight - e.clientY;
});

// Added mouse event listeners
window.addEventListener("mousedown", () => {
    mouse.down = 1;
});

window.addEventListener("mouseup", () => {
    mouse.down = 0;
});


// ------------------------------------------------------------
// Resize
// ------------------------------------------------------------

function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    canvas.width = Math.floor(window.innerWidth * dpr);
    canvas.height = Math.floor(window.innerHeight * dpr);

    canvas.style.width = window.innerWidth + "px";
    canvas.style.height = window.innerHeight + "px";

    gl.viewport(0, 0, canvas.width, canvas.height);

    // Recreate the feedback buffers at the new resolution.
    createFeedbackBuffers();
}

window.addEventListener("resize", resize);


// ------------------------------------------------------------
// Vertex shader
// ------------------------------------------------------------

const vsSource = `
attribute vec2 a_position;

void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
}
`;


// ------------------------------------------------------------
// Fragment shader
// ------------------------------------------------------------

const fsSource = `
// Author @patriciogv - 2015
// http://patriciogonzalezvivo.com
// https://www.reddit.com/r/godot/comments/1jhf9le/need_help_using_custom_noise_function_as_normal/

#extension GL_OES_standard_derivatives : enable
#ifdef GL_ES
precision mediump float;
#endif

uniform vec2 u_resolution;
uniform vec2 u_mouse;
uniform float u_time;
uniform sampler2D normalMap; // Your normal map texture unit
uniform sampler2D u_tex0; // your normal map, loaded via the + button

float random (in vec3 _st) {
    return fract(sin(dot(_st.xy,
                         vec2(12.9898,58.233)))*
        48.5453123);
}

// Based on Morgan McGuire @morgan3d
// https://www.shadertoy.com/view/4dS3Wd
float noise (in vec3 _st) {
    vec3 i = floor(_st);
    vec3 f = fract(_st);

    // Four corners in 2D of a tile
    float a = random(i);
    float b = random(i + vec3(1.0, 0.0, 0.0));
    float c = random(i + vec3(0.0, 1.0, 0.0));
    float d = random(i + vec3(1.0, 1.0, 0.0));

    vec3 u = f * f * (3.0 - 2.0 * f);

    return mix(a, b, u.x) +
            (c - a)* u.y * (1.0 - u.x) +
            (d - b) * u.x * u.y;
}

#define NUM_OCTAVES 3

float fbm ( in vec3 _st) {
    float v = 0.0;
    float a = 0.4;
    vec3 shift = vec3(100.0);
    // Rotate to reduce axial bias
    mat3 rot = mat3(cos(0.5), sin(0.5),
                    -sin(0.5), cos(0.50), 
                    cos(0.0), sin(0.5), 
                   -sin(0.0), cos(0.0), -sin(0.));
    for (int i = 0; i < NUM_OCTAVES; ++i) {
        v += a * noise(_st);
        _st = rot * _st * 2.0 + shift;
        a *= 0.5;
    }
    return v;
}

float rectSDF(vec2 st, vec2 size) {
    vec2 d = abs(st) - size;
    return max(d.x, d.y);
}

// Final noise
float noisify(vec3 point) {
    return -fbm(point * 35.0);
}

vec3 get_noise_normal(vec3 p) {
    float height = noisify(p);
    vec3 slope = -vec3(
        dFdx(height) * u_resolution.x,
        dFdy(height) * u_resolution.y,
        0.2
    );
    return normalize(slope);
}


void main() {
    
    vec3 st = vec3(gl_FragCoord.xy / u_resolution.xy, 0.0);
    
    // make a 2D version
    vec2 stu = gl_FragCoord.xy / u_resolution.xy;
    st -= 0.5;
    st.x *= u_resolution.x / u_resolution.y;

    // set 2D plane
    vec2 planeSize = vec2(1.0, 1.0);
    float plane = rectSDF(stu, planeSize);
    float mask = 1.0 - smoothstep(0.0, 0.005, plane);

    // map st back into 0.0.100 UV space over just the rectangle
    vec2 uv = ( stu / (planeSize * 2.0)) + 0.5;

    // mouse position in normalised space
    vec2 mouseNorm = u_mouse / u_resolution.xy;
    //mouseNorm -= 0.5;
    mouseNorm.x *= u_resolution.x / u_resolution.y;

    // pixel position on screen space
    vec2 pixelPos = uv - 0.5;
    pixelPos.x *= u_resolution.x / u_resolution.y;
    
    vec3 color = vec3(0.0);

    // noise calcs 
    vec3 q = vec3(0.);
    q.x = fbm( st + 0.00*u_time);
    q.y = fbm( st + vec3(1.0));

    vec3 r = vec3(0.);
    r.x = fbm( st + 1.0*q + vec3(1.7,9.2,3.0)+ 0.15*u_time );
    r.y = fbm( st + 1.0*q + vec3(4.3,2.8,0.4)+ 0.126*u_time);
    r.z = fbm( st + 1.0*q + vec3(3.3,2.8,0.0)+ 0.126*u_time);
        
    float f = fbm(st+r);

    color = mix(vec3(0.101961,0.619608,0.666667),
                vec3(1.6667,0.666667,1.498039),
                clamp((f*f)*2.0,0.2,0.5));

    color = mix(color,
                vec3(0.3,0.1,0.564706),
                clamp(length(q),1.0,0.6));

    color = mix(color,
                vec3(0.666667,1,1),
                clamp(length(r.x),0.2,0.7));
    
    // sample and unpack the normal map (RGB 0..1 -> XYZ -1..1)
    vec3 normal = texture2D(u_tex0, uv).rgb;
    //vec3 displace = vec3(uv, 0.0) + vec3(0.0, 0.0, 1.0);
    vec3 noiseNorm = get_noise_normal(vec3(color.x, color.y, color.z * 0.0));

    normal = normalize(normal * 5.0 - 1.0 * noiseNorm);
    //vec3 noise_position = world_position;
    
    // point light at mouse position, 
    float lightHeight = 0.2;
    vec3 lightDir = normalize(vec3(mouseNorm - pixelPos, lightHeight));
    
    // ambient + diffuse
    float diff = max(dot(normal, lightDir*2.0), 1.0);
    vec3 baseColor = color;
    vec3 lit = baseColor * (0.7 + 0.4 * diff); 

    gl_FragColor = vec4((f*f*f+.8*f*f+.5*f)*color,1.);
    color = mix(vec3(0.0), lit, mask);
    gl_FragColor = vec4(color, 1.0);
}
`;

function createShader(gl, type, source) {

    const shader = gl.createShader(type);

    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {

        console.error(
            gl.getShaderInfoLog(shader)
        );

        gl.deleteShader(shader);

        return null;
    }

    return shader;
}

const vertexShader =
    createShader(gl, gl.VERTEX_SHADER, vsSource);

const fragmentShader =
    createShader(gl, gl.FRAGMENT_SHADER, fsSource);

const program = gl.createProgram();

gl.attachShader(program, vertexShader);
gl.attachShader(program, fragmentShader);

gl.linkProgram(program);

if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error(gl.getProgramInfoLog(program));
}

gl.useProgram(program);

const positionBuffer = gl.createBuffer();

gl.bindBuffer(
    gl.ARRAY_BUFFER,
    positionBuffer
);

const positions = new Float32Array([
    -1, -1,
     1, -1,
    -1,  1,

    -1,  1,
     1, -1,
     1,  1
]);

gl.bufferData(
    gl.ARRAY_BUFFER,
    positions,
    gl.STATIC_DRAW
);

const positionLocation =
    gl.getAttribLocation(
        program,
        "a_position"
    );

gl.enableVertexAttribArray(
    positionLocation
);

gl.vertexAttribPointer(
    positionLocation,
    2,
    gl.FLOAT,
    false,
    0,
    0
);

const resolutionLocation =
    gl.getUniformLocation(
        program,
        "u_resolution"
    );

const timeLocation =
    gl.getUniformLocation(
        program,
        "u_time"
    );

const mouseLocation =
    gl.getUniformLocation(
        program,
        "u_mouse"
    );

// Added mouse down uniform location
const mouseDownLocation =
    gl.getUniformLocation(
        program,
        "u_mousedown"
    );

const previousFrameLocation =
    gl.getUniformLocation(
        program,
        "u_previousFrame"
    );


// Feedback buffers

let bufferA = null;
let bufferB = null;


// Create a texture + framebuffer pair.
function createBuffer(width, height) {

    const texture = gl.createTexture();

    gl.bindTexture(
        gl.TEXTURE_2D,
        texture
    );

    gl.texParameteri(
        gl.TEXTURE_2D,
        gl.TEXTURE_MIN_FILTER,
        gl.LINEAR
    );

    gl.texParameteri(
        gl.TEXTURE_2D,
        gl.TEXTURE_MAG_FILTER,
        gl.LINEAR
    );

    gl.texParameteri(
        gl.TEXTURE_2D,
        gl.TEXTURE_WRAP_S,
        gl.CLAMP_TO_EDGE
    );

    gl.texParameteri(
        gl.TEXTURE_2D,
        gl.TEXTURE_WRAP_T,
        gl.CLAMP_TO_EDGE
    );

    // Allocate texture storage.
    gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        width,
        height,
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        null
    );


    const framebuffer =
        gl.createFramebuffer();

    gl.bindFramebuffer(
        gl.FRAMEBUFFER,
        framebuffer
    );

    gl.framebufferTexture2D(
        gl.FRAMEBUFFER,
        gl.COLOR_ATTACHMENT0,
        gl.TEXTURE_2D,
        texture,
        0
    );


    const status =
        gl.checkFramebufferStatus(
            gl.FRAMEBUFFER
        );

    if (status !== gl.FRAMEBUFFER_COMPLETE) {
        console.error(
            "Framebuffer incomplete:",
            status
        );
    }


    gl.bindFramebuffer(
        gl.FRAMEBUFFER,
        null
    );

    gl.bindTexture(
        gl.TEXTURE_2D,
        null
    );


    return {
        framebuffer,
        texture
    };
}


// Recreate both buffers after resizing.
function createFeedbackBuffers() {

    if (bufferA) {
        gl.deleteFramebuffer(bufferA.framebuffer);
        gl.deleteTexture(bufferA.texture);

        gl.deleteFramebuffer(bufferB.framebuffer);
        gl.deleteTexture(bufferB.texture);
    }

    bufferA =
        createBuffer(
            canvas.width,
            canvas.height
        );

    bufferB =
        createBuffer(
            canvas.width,
            canvas.height
        );


    // Clear both buffers to black.
    gl.bindFramebuffer(
        gl.FRAMEBUFFER,
        bufferA.framebuffer
    );

    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);


    gl.bindFramebuffer(
        gl.FRAMEBUFFER,
        bufferB.framebuffer
    );

    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);


    gl.bindFramebuffer(
        gl.FRAMEBUFFER,
        null
    );
}


// Initial buffers.
resize();


// ------------------------------------------------------------
// Render loop
// ------------------------------------------------------------

let startTime = performance.now();

function render() {

    const currentTime =
        (performance.now() - startTime) * 0.001;


    // --------------------------------------------------------
    // 1. Render into bufferB
    // --------------------------------------------------------

    gl.bindFramebuffer(
        gl.FRAMEBUFFER,
        bufferB.framebuffer
    );

    gl.viewport(
        0,
        0,
        canvas.width,
        canvas.height
    );


    // Pass uniforms.
    gl.uniform2f(
        resolutionLocation,
        canvas.width,
        canvas.height
    );

    gl.uniform1f(
        timeLocation,
        currentTime
    );

    gl.uniform2f(
        mouseLocation,
        mouse.x,
        mouse.y
    );

    // Pass mouse down state to uniform.
    gl.uniform1f(
        mouseDownLocation,
        mouse.down
    );


    // --------------------------------------------------------
    // Give the shader bufferA (previous frame)
    // --------------------------------------------------------

    gl.activeTexture(
        gl.TEXTURE0
    );

    gl.bindTexture(
        gl.TEXTURE_2D,
        bufferA.texture
    );

    gl.uniform1i(
        previousFrameLocation,
        0
    );


    // Draw shader into bufferB.
    gl.drawArrays(
        gl.TRIANGLES,
        0,
        6
    );


    // --------------------------------------------------------
    // 2. Display bufferB on the screen
    // --------------------------------------------------------

    gl.bindFramebuffer(
        gl.FRAMEBUFFER,
        null
    );

    gl.viewport(
        0,
        0,
        canvas.width,
        canvas.height
    );


    // Copy bufferB to the screen.
    gl.bindTexture(
        gl.TEXTURE_2D,
        bufferB.texture
    );

    gl.drawArrays(
        gl.TRIANGLES,
        0,
        6
    );


    // --------------------------------------------------------
    // 3. Swap buffers
    // --------------------------------------------------------

    const temp = bufferA;

    bufferA = bufferB;
    bufferB = temp;


    requestAnimationFrame(render);
}

render();
