// Deteksi tiupan lewat mikrofon: ukur energi (RMS) frekuensi rendah.
// Tiupan ke mic menghasilkan noise lebar dengan energi besar; suara bicara biasa jarang
// mempertahankan level setinggi itu > 250 ms, jadi syaratnya: di atas ambang selama beberapa frame.

export interface BlowListener {
  stop: () => void
}

export async function listenForBlow(
  onLevel: (level: number) => void,
  onBlow: () => void,
): Promise<BlowListener> {
  if (!navigator.mediaDevices?.getUserMedia) throw new Error('unsupported')
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
  })
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
  const ctx = new AC()
  await ctx.resume()
  const src = ctx.createMediaStreamSource(stream)
  const an = ctx.createAnalyser()
  an.fftSize = 1024
  src.connect(an)
  const data = new Uint8Array(an.frequencyBinCount)
  let raf = 0
  let above = 0
  let done = false

  const tick = () => {
    an.getByteFrequencyData(data)
    // fokus ke bin rendah (< ~1.5 kHz) tempat energi tiupan paling besar
    const n = Math.floor(data.length * 0.15)
    let sum = 0
    for (let i = 0; i < n; i++) sum += data[i] * data[i]
    const rms = Math.sqrt(sum / n) / 255
    onLevel(rms)
    above = rms > 0.55 ? above + 1 : Math.max(0, above - 1)
    if (above > 14 && !done) {
      done = true
      onBlow()
      return
    }
    raf = requestAnimationFrame(tick)
  }
  raf = requestAnimationFrame(tick)

  return {
    stop() {
      cancelAnimationFrame(raf)
      stream.getTracks().forEach((t) => t.stop())
      void ctx.close()
    },
  }
}
