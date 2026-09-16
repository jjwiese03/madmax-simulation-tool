import { AutoTokenizer } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.0.1';
import * as ort from "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.21.0/dist/ort.mjs";

// WASM-Binaries müssen von derselben Version wie ort.mjs kommen
ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.21.0/dist/';
ort.env.wasm.numThreads = 1; // vermeidet Cross-Origin-Isolation-Probleme

const DECIMAL_SYMBOL = '.';
const CLASS_LABELS = ['none', 'position', 'distance', 'width']; // Index 0 = kein Treffer, passt sie ggf. an deine Reihenfolge an

// ----------------------------------------------------
// Preprocessing — Äquivalent zu Parser.prepare_input() in Python
// ----------------------------------------------------

function splitText(text, decimalSymbol = DECIMAL_SYMBOL) {
    const ds = decimalSymbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const splitPattern = new RegExp(`(?<![\\d${ds}])(?=\\d)|(?<=\\d)(?![\\d${ds}])`);
    return text.split(splitPattern).filter(seg => seg !== '');
}

async function prepareInput(tokenizer, text) {

    const  tokenIds = []
    const numberMask = [] 
    const  values = []

    for (const seg of splitText(text)) {
        if (/^\d/.test(seg)) {
            tokenIds.push(0);           // Dummy-ID, wird im Modell weggenullt
            numberMask.push(true);
            values.push(seg);
        } else {
            const ids = await tokenizer.encode(seg, { add_special_tokens: false });
            for (const tid of ids) {
                tokenIds.push(tid);
                numberMask.push(false);
                values.push(await tokenizer.decode([tid]));
            }
        }
    }

    return { tokenIds, numberMask, values };
}
 
export default async function evaluateText(text) {
    const tokenizer = await AutoTokenizer.from_pretrained('Xenova/multilingual-e5-base');
    const session = await ort.InferenceSession.create('/frontend/src/ML/parser.onnx');


    const { tokenIds, numberMask, values } = await prepareInput(tokenizer, text);
    const seqLen = tokenIds.length;

    const feeds = {
        token_ids: new ort.Tensor('int64', BigInt64Array.from(tokenIds.map(BigInt)), [seqLen]),
        number_mask: new ort.Tensor('bool', Uint8Array.from(numberMask.map(Number)), [seqLen]),
    };

    const results = await session.run(feeds);
    const predictions = results.predictions.data;
    const numClasses = predictions.length / seqLen;

    const result = {};
    CLASS_LABELS.forEach((label) => result[label] = [])

    for (let i = 0; i < numberMask.length; i++) {
        if (!numberMask[i]) continue;

        const row = predictions.slice(i * numClasses, (i + 1) * numClasses);
        let bestClass = 0;
        for (let c = 1; c < numClasses; c++) {
            if (row[c] > row[bestClass]) bestClass = c;
        }

        result[CLASS_LABELS[bestClass]].push(parseFloat(values[i]))
    }

    return result;
}

