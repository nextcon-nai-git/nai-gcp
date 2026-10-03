"use server";
/**
 * @fileOverview NAI Voice Engine - Gerador de respostas em áudio via Genkit TTS.
 * Converte o parecer técnico da NAI em fala para suporte hands-free em campo.
 */

import { ai } from "@/ai/genkit";
import { z } from "genkit";
import { googleAI } from "@genkit-ai/google-genai";
import wav from "wav";

const VoiceOutputSchema = z.object({
  audioDataUri: z.string().describe("Áudio em formato data URI base64."),
});

/**
 * Converte dados PCM brutos retornados pelo Gemini em um arquivo WAV válido base64.
 */
async function toWav(
  pcmData: Buffer,
  channels = 1,
  rate = 24000,
  sampleWidth = 2
): Promise<string> {
  return new Promise((resolve, reject) => {
    const writer = new wav.Writer({
      channels,
      sampleRate: rate,
      bitDepth: sampleWidth * 8,
    });

    const bufs = [] as any[];
    writer.on("error", reject);
    writer.on("data", function (d) {
      bufs.push(d);
    });
    writer.on("end", function () {
      resolve(Buffer.concat(bufs).toString("base64"));
    });

    writer.write(pcmData);
    writer.end();
  });
}

/**
 * Gera áudio a partir de um texto técnico de SST.
 */
export async function generateVoiceResponse(text: string): Promise<{ audioDataUri: string }> {
  return voiceResponseFlow(text);
}

const voiceResponseFlow = ai.defineFlow(
  {
    name: "voiceResponseFlow",
    inputSchema: z.string(),
    outputSchema: VoiceOutputSchema,
  },
  async (text) => {
    const { media } = await ai.generate({
      model: googleAI.model("gemini-2.5-flash-preview-tts"),
      config: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: "Algenib" }, // Voz sóbria e técnica
          },
        },
      },
      prompt: `Leia o seguinte parecer técnico de SST de forma clara e profissional: ${text}`,
    });

    if (!media) {
      throw new Error("Falha ao gerar áudio pela NAI.");
    }

    const audioBuffer = Buffer.from(media.url.substring(media.url.indexOf(",") + 1), "base64");

    return {
      audioDataUri: "data:audio/wav;base64," + (await toWav(audioBuffer)),
    };
  }
);
