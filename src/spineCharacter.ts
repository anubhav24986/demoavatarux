
import * as PIXI from 'pixi.js'
import {
  Spine,
  SpineTexture,
  TextureAtlas,
  AtlasAttachmentLoader,
  SkeletonJson,
} from '@esotericsoftware/spine-pixi-v8'

// ── static imports ───────────────────────────────────────────────────────────

// Eagerly import every character PNG as a URL
const characterPngUrls = import.meta.glob(
  '../character/character/*.png',
  { query: '?url', import: 'default', eager: true },
) as Record<string, string>


import characterJson from '../character/character/character.json'

/**
 * Load character textures, build a dynamic atlas, and return a Spine
 * container playing `character_idle` on loop.
 */
export async function createCharacter(): Promise<Spine> {
  // 1. Load every character PNG as a PIXI Texture
  const textures: Record<string, PIXI.Texture> = {}
  await Promise.all(
    Object.entries(characterPngUrls).map(async ([path, url]) => {
      const name = path.split('/').pop()!.replace('.png', '')
      textures[name] = await PIXI.Assets.load<PIXI.Texture>(url)
    }),
  )


  const atlasLines: string[] = []
  for (const [name, tex] of Object.entries(textures)) {
    const w = tex.width
    const h = tex.height
    atlasLines.push(
      `${name}.png`,
      `size: ${w}, ${h}`,
      'filter: Linear, Linear',
      'repeat: none',
      name,
      `  bounds: 0, 0, ${w}, ${h}`,
      '', // blank line = page separator
    )
  }
  const atlasText = atlasLines.join('\n')


  const atlas = new TextureAtlas(atlasText)
  for (const page of atlas.pages) {
    const name = page.name.replace('.png', '')
    const pixiTex = textures[name]
    if (pixiTex) {
      page.setTexture(SpineTexture.from(pixiTex.source))
    }
  }


  const attachmentLoader = new AtlasAttachmentLoader(atlas)
  const skeletonJson = new SkeletonJson(attachmentLoader)

  const skeletonData = skeletonJson.readSkeletonData(characterJson as any)


  const spine = new Spine(skeletonData)
  spine.state.setAnimation(0, 'character_idle', true)
//  spine.state.setAnimation(0, 'character_small_win', true)
//  spine.state.setAnimation(0, 'character_wild_landing', true)
//  spine.state.setAnimation(0, 'character_wild_throw', true)
//  spine.state.setAnimation(0, 'character_bonus_anticipation', true)
//  spine.state.setAnimation(0, 'character_bonus_anticipation_lose', true)
// spine.state.setAnimation(0, 'character_bonus_anticipation_win', true)

  return spine
}
