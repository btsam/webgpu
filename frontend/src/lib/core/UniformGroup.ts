import ObjectGPU from "./ObjectGPU";
import Renderer from "../Renderer";
import MathArray from "@math.gl/core/src/classes/base/math-array";
import Texture from "../textures/Texture";

type Uniform = {
    name: string,
    size: number,
    data: MathArray | number,
    offset: number,
    usage:GPUShaderStageFlags,
    dirty:boolean
}

type TextureUniform = {
    name: string,
    texture: Texture;
    usage:GPUShaderStageFlags,
    sampleType:GPUTextureSampleType
    dimension:GPUTextureViewDimension,
}
type SamplerUniform = {
    name: string,
    sampler: GPUSampler;
    usage:GPUShaderStageFlags,

}
export default class UniformGroup extends ObjectGPU {
    public static instance:UniformGroup
    public bindGroupLayout: GPUBindGroupLayout;
    public bindGroup: GPUBindGroup;
    public isBufferDirty: boolean = true;
    public isBindGroupDirty: boolean = true;
    public uniforms: Array<Uniform> = [];
    public textureUniforms: Array<TextureUniform> = [];
    public samplerUniforms: Array<SamplerUniform> = [];
    public buffer!: GPUBuffer;
    public visibility: GPUShaderStageFlags = GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT;
    private bufferData: Float32Array;
    private nameInShader: string;
    private typeInShader: string;
    private bufferIsDirty: boolean;

    constructor(renderer: Renderer, label = "", nameInShader:string) {
        super(renderer, label);
        this.nameInShader =nameInShader;
        this.typeInShader =  this.nameInShader.charAt(0).toUpperCase() +  this.nameInShader.slice(1);
        this.renderer.addUniformGroup(this)

    }
    addUniform(name: string, value: MathArray | number,usage:GPUShaderStageFlags=GPUShaderStage.FRAGMENT){
        const found = this.uniforms.find((element) => element.name == name);
        if(found)
        {
            console.log("uniform already exist "+this.label+" "+name )
            return;
        }
        let size = 0;
        if (typeof value == "number") {
            size = 1;

        } else {
            size = value.length;
        }

        let u = {
            name: name,
            data: value,
            size: size,
            offset: 0,
            usage:usage,
            dirty:true,
        }

        this.uniforms.push(u);
    }
    addTexture(name: string, value: Texture,sampleType:GPUTextureSampleType,dimension:GPUTextureViewDimension,usage:GPUShaderStageFlags ) {
        this.textureUniforms.push({name:name,sampleType:sampleType,texture:value,usage:usage,dimension:dimension})

    }
    addSampler(name: string) {
        let sampler =this.renderer.device.createSampler({magFilter:"linear",minFilter:"linear" })
        this.samplerUniforms.push({name:name,sampler:sampler,usage:GPUShaderStage.FRAGMENT})
    }
    setUniform(name: string, value: MathArray | number) {
        const found = this.uniforms.find((element) => element.name == name);

        if (found) {
            this.bufferIsDirty =true;
            found.data = value;

            if (this.bufferData) {
                if (found.size == 1) {
                    this.bufferData[found.offset] = found.data as number;
                } else {
                    this.bufferData.set(found.data as MathArray, found.offset)

                }

            }

        } else {
            console.log("uniform not found", name,value)
        }

    }
    setTexture(name:string,value:Texture)
    {
        const found = this.textureUniforms.find((element) => element.name == name);

        if (found) {
            found.texture=value;
            this.isBindGroupDirty =true;
        }else
        {
            console.log("uniform not found", name,value)
        }

    }
    update() {

     this.updateData();
        for (let t of this.textureUniforms)
        {
            if(t.texture.isDirty)this.isBindGroupDirty =true;
        }



        if (!this.isBufferDirty) {
            if(this.isBindGroupDirty){
                this.updateBindGroup();
                this.isBindGroupDirty =false;
            }


        }
        if (!this.buffer) {
            this.makeBuffer();
            this.updateBindGroup()
        } else {
           if(  this.isBufferDirty) this.updateBuffer();
            this.updateBuffer();

        }
       // this.updateBindGroup()
        this.isBufferDirty= false;
        this.isBindGroupDirty =false;

    }

    updateBuffer() {
/*if(this.label =="lightShader"){
    console.log(this.bufferData)
        }*/
        this.device.queue.writeBuffer(
            this.buffer,
            0,
            this.bufferData.buffer,
            this.bufferData.byteOffset,
            this.bufferData.byteLength
        );

    }



    private makeBuffer() {
        let dataSize = 0;
        console.log(this.label)
        for (let u of this.uniforms) {

            u.offset = dataSize;

            dataSize += u.size;
            console.log(u.size*4 )
        }

        dataSize =Math.ceil(dataSize/16)*16

        this.bufferData = new Float32Array(dataSize);
        for (let u of this.uniforms) {
            if (u.size == 1) {
                this.bufferData[u.offset] = u.data as number;
            } else {
                this.bufferData.set(u.data as MathArray, u.offset);

            }
        }


        this.buffer = this.device.createBuffer({
            size: this.bufferData.byteLength,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });
        this.buffer.label = "uniformBuffer_" + this.label;


        this.device.queue.writeBuffer(
            this.buffer,
            0,
            this.bufferData.buffer,
            this.bufferData.byteOffset,
            this.bufferData.byteLength
        );
        let bindingCount =0;
        let entriesLayout: Array<GPUBindGroupLayoutEntry> = []
        entriesLayout.push({
            binding: bindingCount,
            visibility: this.visibility,
            buffer: {},
        })
        bindingCount++;
        for (let t of this.textureUniforms) {
            entriesLayout.push({
                binding:  bindingCount,
                visibility: t.usage,
                texture: {
                    sampleType:t.sampleType,
                    viewDimension:  t.dimension,
                    multisampled:false,

                },
            })
            bindingCount++;
        }
        for (let t of this.samplerUniforms) {
            entriesLayout.push({
                binding:  bindingCount,
                visibility: t.usage,
                sampler: {

                },
            })
            bindingCount++;
        }
        let bindGroupLayoutDescriptor: GPUBindGroupLayoutDescriptor = {
            label: "BindGroupLayout_" + this.label,
            entries: entriesLayout,

        }



        this.bindGroupLayout = this.device.createBindGroupLayout(bindGroupLayoutDescriptor);








    }
    private updateBindGroup() {

        let entries:Array<GPUBindGroupEntry>=[]
        let bindingCount =0;
        entries.push(
            {
                binding: bindingCount,
                resource: {
                    buffer: this.buffer,
                },
            }
        )
        bindingCount++;

        for (let t of this.textureUniforms){
            entries.push(
                {
                    binding: bindingCount,
                    resource:  t.texture.textureGPU.createView(),

                }
            )

            bindingCount++;
        }
        for (let t of this.samplerUniforms){
            entries.push(
                {
                    binding: bindingCount,
                    resource:  t.sampler,

                }
            )
            bindingCount++;
        }



        this.bindGroup = this.device.createBindGroup({
            label: "BindGroup_" + this.label,
            layout: this.bindGroupLayout,
            entries: entries,
        });

    }
    private getUniformStruct() {
        let uniformText = "";
        for (let uniform of this.uniforms) {
            uniformText += uniform.name + " : ";
            if (uniform.size == 1) uniformText += "f32,";
            else if (uniform.size == 2) uniformText += "vec2 <f32>,"
            else if (uniform.size == 3) uniformText += "vec3 <f32>,"
            else if (uniform.size == 4) uniformText += "vec4 <f32>,"
            else if (uniform.size == 9) uniformText += "mat3x3 <f32>,"
            else if (uniform.size == 16) uniformText += "mat4x4 <f32>,";

        }
        return uniformText
    }
    getShaderText(id: number) {

        let textureText=""
        let bindingCount=1
        if(this.textureUniforms.length){
            for(let s of this.textureUniforms){
                textureText +=`@group(${id}) @binding(${bindingCount})  var `+s.name +`:texture_2d<f32>;`+"\n";
                bindingCount++;
            }
        }
        if(this.samplerUniforms.length){
           for(let s of this.samplerUniforms){
               textureText +=`@group(${id}) @binding(${bindingCount})  var `+s.name +`:sampler;`+"\n";
               bindingCount++
           }

        }
        let a =  /* wgsl */ `      
struct ${this.typeInShader}
{
    ${this.getUniformStruct()}
}
@group(${id}) @binding(0)  var<uniform> ${this.nameInShader} : ${this.typeInShader} ;
${textureText}

`;

        return a;
    }

    protected updateData() {

    }



}
