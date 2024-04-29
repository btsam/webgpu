import Shader from "../lib/core/Shader";

import DefaultTextures from "../lib/textures/DefaultTextures";
import {ShaderType} from "../lib/core/ShaderTypes";
import Camera from "../lib/Camera";
import ModelTransform from "../lib/model/ModelTransform";
import {Vector2} from "math.gl";

export default class LaptopDistordShader extends Shader{


    init(){

        if(this.attributes.length==0) {
            this.addAttribute("aPos", ShaderType.vec3);
            this.addAttribute("aNormal", ShaderType.vec3);
            this.addAttribute("aUV0", ShaderType.vec2);

        }
        this.addUniform("offsetBuy",new Vector2());
        this.addUniform("time",0);
        this.addUniform("ratio",0);
        this.addUniform("offset",0);
        this.addTexture("image",DefaultTextures.getWhite(this.renderer))
        this.addTexture("buy",this.renderer.texturesByLabel["LT_buy.png"])
        this.addSampler("mySampler")

        this.needsTransform =true;
        this.needsCamera=true;
    }
    getShaderCode(): string {
        return /* wgsl */ `
///////////////////////////////////////////////////////////      
struct VertexOutput
{
   @location(0) uv0 : vec2f,
    @location(1) normal : vec3f,
    @builtin(position) position : vec4f
  
}
struct GBufferOutput {
  @location(0) color : vec4f,
  @location(1) normal : vec4f,
    @location(2) mra : vec4f,
   
}

${Camera.getShaderText(0)}
${ModelTransform.getShaderText(1)}
${this.getShaderUniforms(2)}

@vertex
fn mainVertex( ${this.getShaderAttributes()} ) -> VertexOutput
{
    var output : VertexOutput;
    
    output.position =camera.viewProjectionMatrix*model.modelMatrix *vec4( aPos,1.0);
    output.uv0 =aUV0;
   
    output.normal =model.normalMatrix *aNormal;
    
    return output;
}

@fragment
fn mainFragment(@location(0) uv0: vec2f,@location(1) normal: vec3f) -> GBufferOutput
{
    var output : GBufferOutput;
  let uv = uv0*vec2(1.0,1./uniforms.ratio);
 
   
   
    output.color = textureSample(image, mySampler,uv );
    output.color.z = textureSample(image, mySampler,uv+vec2(uniforms.offset*-0.05,0.0) ).z;
   output.color.x = textureSample(image, mySampler,uv+vec2(uniforms.offset*0.05,0.0) ).x;
    
    let b = textureSample(buy, mySampler,uv+uniforms.offsetBuy );
     output.color =mix( output.color,b,b.w);
    
    output.normal =vec4(normalize(normal)*0.5+0.5,1.0);
    output.mra =vec4(0.5,0.3,0.5,0.5);
 

    return output;
 
}
///////////////////////////////////////////////////////////
        
        
        
        
        
        
        
        
        `
    }



}
