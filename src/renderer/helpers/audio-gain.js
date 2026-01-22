/**
 * Audio Gain Helper
 * 使用 Web Audio API 增強音量，讓我們的聲音比別人大聲
 */

// 儲存已連接的 audio context 和 gain nodes
const audioContextMap = new WeakMap()

/**
 * 為 audio/video 元素套用音量增益
 * @param {HTMLMediaElement} mediaElement - audio 或 video 元素
 * @param {number} gainValue - 增益倍數 (1.0 = 100%, 1.5 = 150%, 2.0 = 200%)
 * @returns {{ gainNode: GainNode, audioContext: AudioContext } | null}
 */
export function applyAudioGain(mediaElement, gainValue = 1.5) {
  if (!mediaElement || !(mediaElement instanceof HTMLMediaElement)) {
    console.warn('[AudioGain] Invalid media element')
    return null
  }

  // 如果已經有 gain node，直接更新值
  const existing = audioContextMap.get(mediaElement)
  if (existing) {
    existing.gainNode.gain.value = gainValue
    console.log('[AudioGain] Updated gain to', gainValue)
    return existing
  }

  try {
    // 建立 Audio Context
    const audioContext = new (window.AudioContext || window.webkitAudioContext)()

    // 建立 media source
    const source = audioContext.createMediaElementSource(mediaElement)

    // 建立 gain node
    const gainNode = audioContext.createGain()
    gainNode.gain.value = gainValue

    // 連接: source -> gain -> destination
    source.connect(gainNode)
    gainNode.connect(audioContext.destination)

    // 儲存到 map
    const result = { audioContext, gainNode, source }
    audioContextMap.set(mediaElement, result)

    console.log('[AudioGain] Applied gain', gainValue, 'to media element')
    return result
  } catch (error) {
    console.error('[AudioGain] Failed to apply gain:', error)
    return null
  }
}

/**
 * 更新已套用的增益值
 * @param {HTMLMediaElement} mediaElement
 * @param {number} gainValue
 */
export function updateAudioGain(mediaElement, gainValue) {
  const existing = audioContextMap.get(mediaElement)
  if (existing) {
    existing.gainNode.gain.value = gainValue
    console.log('[AudioGain] Updated gain to', gainValue)
    return true
  }
  return false
}

/**
 * 移除音量增益
 * @param {HTMLMediaElement} mediaElement
 */
export function removeAudioGain(mediaElement) {
  const existing = audioContextMap.get(mediaElement)
  if (existing) {
    try {
      existing.source.disconnect()
      existing.gainNode.disconnect()
      existing.audioContext.close()
    } catch (e) {
      // ignore
    }
    audioContextMap.delete(mediaElement)
    console.log('[AudioGain] Removed gain from media element')
  }
}

/**
 * 檢查元素是否已套用增益
 * @param {HTMLMediaElement} mediaElement
 * @returns {boolean}
 */
export function hasAudioGain(mediaElement) {
  return audioContextMap.has(mediaElement)
}

/**
 * 取得目前的增益值
 * @param {HTMLMediaElement} mediaElement
 * @returns {number | null}
 */
export function getAudioGain(mediaElement) {
  const existing = audioContextMap.get(mediaElement)
  return existing ? existing.gainNode.gain.value : null
}
