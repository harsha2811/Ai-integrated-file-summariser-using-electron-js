const path = require('path');
const { app, BrowserWindow, ipcMain } = require('electron');
const { GoogleGenerativeAI } = require('@google/generative-ai');

let mainWindow;

function createMainWindow() {
  mainWindow = new BrowserWindow({
    title: 'File Summarizer',
    width: 700,
    height: 700,
    minWidth: 700,
    minHeight: 700,
    icon: path.join(__dirname, 'renderer/icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer/index.html'));
}

app.whenReady().then(() => {
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});


// AI integration

const genAI = new GoogleGenerativeAI('[YOUR-API-KEY]');

const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash-latest' });

async function run(resultText, level) {
  const resultTexts = resultText.split('\n').join(' ');
  const prompt = `
  Desired summary length: ${level}
Summarize the following text, which includes tables and code snippets:
<<<${resultTexts}>>>

The output should be in this format, and only one level should be displayed:

level: [Selected Level Name]

summary: [Selected Level Summarized Text. Ensure the summary adheres to the specified format and word count requirements. Address tables and code snippets by summarizing the main findings and purpose of the content. The summary should be divided into paragraphs as follows:]

For Short:
- 10 paragraphs
- Each paragraph should contain exactly 50 words.
- Focus on providing a concise overview of key points, including table findings and code functionality.

For Medium:
- 20 paragraphs
- Each paragraph should contain exactly 50 words.
- Provide a detailed summary, covering main points, table results, and code explanations.

For Long:
- 40 paragraphs
- Each paragraph should contain exactly 50 words.
- Offer a comprehensive analysis, including detailed descriptions of tables, code logic, and overall findings.

Ensure that each paragraph maintains coherence and addresses the content effectively.
`;


  const result = await model.generateContent(prompt);
  const response = await result.response;
  const text = await response.text();
  return text;
}

ipcMain.handle('get-function-result', async (event, resultText, level) => {
  return run(resultText, level);
});

//reading file functions 

const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const fs = require('fs');


async function readPDF(filePath) {
  const fileBuffer = fs.readFileSync(filePath);
  const data = await pdfParse(fileBuffer);
  return data.text;
}

async function readWord(filePath) {
  const fileBuffer = fs.readFileSync(filePath);
  const result = await mammoth.extractRawText({ buffer: fileBuffer });
  return result.value;
}

async function readDocument(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  let text = '';

  if (ext === '.pdf') {
    text = await readPDF(filePath);
  } else if (ext === '.docx') {
    text = await readWord(filePath);
  } else {
    throw new Error('Unsupported file type');
  }

  //   console.log(text);
  // Store the text in a variable
  return text;
}

ipcMain.handle('get-text-result', async (event, filePath) => {
  return readDocument(filePath);

});

//write output into a pdf

const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');

ipcMain.handle('create-pdf', async (event, text, fileName_pth, level) => {
  try {
    const pdfDoc = await PDFDocument.create();
    const timesRomanFont = await pdfDoc.embedFont(StandardFonts.TimesRoman);
    const pageSize = [595.28, 841.89]; // A4 size in points

    const fontSize = 12;
    const margin = 50;
    const lineHeight = fontSize * 1.2;
    let currentPage = pdfDoc.addPage(pageSize);
    let y = pageSize[1] - margin;

    const lines = text.split('\n');
    lines.forEach(line => {
      const words = line.split(' ');
      let currentLine = '';

      words.forEach(word => {
        if (timesRomanFont.widthOfTextAtSize(currentLine + ' ' + word, fontSize) < pageSize[0] - 2 * margin) {
          currentLine += ' ' + word;
        } else {
          if (y - lineHeight < margin) {
            currentPage = pdfDoc.addPage(pageSize);
            y = pageSize[1] - margin;
          }
          currentPage.drawText(currentLine.trim(), {
            x: margin,
            y: y,
            size: fontSize,
            font: timesRomanFont,
            color: rgb(0, 0, 0),
          });
          y -= lineHeight;
          currentLine = word;
        }
      });

      if (currentLine) {
        if (y - lineHeight < margin) {
          currentPage = pdfDoc.addPage(pageSize);
          y = pageSize[1] - margin;
        }
        currentPage.drawText(currentLine.trim(), {
          x: margin,
          y: y,
          size: fontSize,
          font: timesRomanFont,
          color: rgb(0, 0, 0),
        });
        y -= lineHeight;
      }
    });

    const pdfBytes = await pdfDoc.save();

    // Ensure directory exists
    const outputDir = path.dirname(fileName_pth);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Incremental Counter Logic
    const counterFilePath = path.join(outputDir, 'counter.txt');
    let counter = 1;

    if (fs.existsSync(counterFilePath)) {
      counter = parseInt(fs.readFileSync(counterFilePath, 'utf-8'), 10) + 1;
    }

    fs.writeFileSync(counterFilePath, counter.toString());

    // Generate a unique filename with counter
    const outputPath = path.join(outputDir, `${path.basename(fileName_pth, path.extname(fileName_pth))}_output_${level}_${counter}.pdf`);
    fs.writeFileSync(outputPath, pdfBytes);

    return outputPath;
  } catch (error) {
    console.error('Error creating PDF:', error);
    throw error;
  }
});