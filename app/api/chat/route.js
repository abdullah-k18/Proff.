import { NextResponse } from "next/server";
import { Pinecone } from "@pinecone-database/pinecone";
import { HfInference } from '@huggingface/inference';
import OpenAI from "openai";

const systemPrompt = "You are a rate my professor agent to help students find classes. For every user question, return the top 3 professors that match the query.";

export async function POST(req) {
    const data = await req.json();

    const pc = new Pinecone({
        apiKey: process.env.PINECONE_API_KEY,
    });
    const index = pc.index('rag').namespace('reviews-1');

    const hf = new HfInference(process.env.API_TOKEN);

    const text = data[data.length - 1].content;

    try {
        const embeddingData = await hf.featureExtraction({
            model: 'intfloat/e5-small-v2',
            inputs: text
        });

        if (!embeddingData || !Array.isArray(embeddingData)) {
            throw new Error("Failed to extract embeddings or unexpected format");
        }

        const results = await index.query({
            topK: 3,
            includeMetadata: true,
            vector: embeddingData
        });

        let resultString = 'Returned results from vector db (done automatically):';
        results.matches.forEach((match) => {
            resultString += `\n
            Professor: ${match.id}
            Review: ${match.metadata.review}
            Subject: ${match.metadata.subject}
            Stars: ${match.metadata.stars}
            \n\n`;
        });

        const lastMessage = data[data.length - 1];
        const lastMessageContent = lastMessage.content + resultString;
        const lastDataWithoutLastMessage = data.slice(0, data.length - 1);

        const openai = new OpenAI({
            apiKey: process.env.OPENROUTER_API_KEY,
            baseURL: "https://openrouter.ai/api/v1",
        });

        const completion = await openai.chat.completions.create({
            messages: [
                { role: 'system', content: systemPrompt },
                ...lastDataWithoutLastMessage,
                { role: 'user', content: lastMessageContent }
            ],
            model: 'openai/gpt-3.5-turbo',
            stream: true
        });

        const stream = new ReadableStream({
            async start(controller) {
                const encoder = new TextEncoder();
                try {
                    for await (const chunk of completion) {
                        const content = chunk.choices[0]?.delta?.content;
                        if (content) {
                            const text = encoder.encode(content);
                            controller.enqueue(text);
                        }
                    }
                } catch (err) {
                    controller.error(err);
                } finally {
                    controller.close();
                }
            },
        });

        return new NextResponse(stream);

    } catch (error) {
        console.error("Error:", error);
        return NextResponse.json({ error: error.message });
    }
}
