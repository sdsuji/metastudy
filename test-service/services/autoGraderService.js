const { GetObjectCommand } = require("@aws-sdk/client-s3");
const s3Client = require("../config/s3");
const Test = require("../models/Test");

// Standardized Markers - Tell students to use this in their submitted text file
const START_MARKER = '###Q_ANSWER_START_'; 
const END_MARKER = '_Q_ANSWER_END###';

async function extractAnswers(fileId) {
    if (!fileId) throw new Error("File ID is missing for extraction.");
    
    const command = new GetObjectCommand({
        Bucket: process.env.S3_BUCKET_NAME, Key: fileId,
    });

    const response = await s3Client.send(command);
    // ASSUMPTION: File content is a text format (e.g., .txt)
    const fileContent = await response.Body.transformToString();

    const extracted = {};
    for (let i = 1; i <= 10; i++) { // Check for up to 10 questions
        const qStartMarker = START_MARKER + i;
        const qEndMarker = END_MARKER + i;

        const startIndex = fileContent.indexOf(qStartMarker);
        const endIndex = fileContent.indexOf(qEndMarker);

        if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
            let answer = fileContent.substring(startIndex + qStartMarker.length, endIndex);
            
            // ⭐️ REFINEMENT HERE: Remove ALL whitespace (spaces, tabs, newlines) 
            // and convert to lowercase for maximum format tolerance.
            answer = answer.replace(/\s/g, '').toLowerCase(); 
            // ---------------------------------------------------------------
            
            extracted[`Q${i}`] = answer;
        }
    }
    
    if (Object.keys(extracted).length === 0) {
        throw new Error("No answers extracted. Ensure the file uses the correct markers (e.g., ###Q_ANSWER_START_1..._Q_ANSWER_END###1).");
    }

    return extracted;
}

function compareAnswers(studentAnswers, solutionAnswers) {
    let correctCount = 0;
    const totalQuestions = Object.keys(solutionAnswers).length;
    const maxMarks = 10; // Total marks for the test
    const questionMarks = totalQuestions > 0 ? maxMarks / totalQuestions : 0; 

    for (const qKey in solutionAnswers) {
        const studentAns = studentAnswers[qKey] || "";
        const solutionAns = solutionAnswers[qKey];
        
        // Comparison is now case and space insensitive!
        if (studentAns === solutionAns) {
            correctCount++;
        }
    }

    const marks = correctCount * questionMarks;

    return { marks: marks, totalQuestions, feedbackSummary: `${correctCount} out of ${totalQuestions} questions correct.` };
}

exports.runAutoGrade = async (submission) => {
    try {
        const test = await Test.findById(submission.testId);
        if (!test || test.gradingMethod !== 'auto' || !test.solutionFileId) {
            throw new Error("Test not configured for auto-grading.");
        }

        // 1. Extract Solution
        const solutionAnswers = await extractAnswers(test.solutionFileId);

        // 2. Extract Submission
        submission.autoGradeStatus = 'extracted';
        await submission.save();
        
        const studentAnswers = await extractAnswers(submission.fileId);
        
        // 3. Compare and Score
        const results = compareAnswers(studentAnswers, solutionAnswers);

        // 4. Update Submission
        submission.marks = parseFloat(results.marks.toFixed(2));
        submission.feedback = `Auto-Grade Result: ${results.feedbackSummary} Total Score: ${submission.marks} / 10`;
        submission.gradedAt = new Date();
        submission.gradedBy = "auto-grader-system";
        submission.autoGradeStatus = 'scored';

        await submission.save();
        return { success: true, marks: submission.marks };

    } catch (err) {
        console.error(`Auto-Grading Failed for Submission ${submission._id}:`, err.message);
        submission.autoGradeStatus = 'error';
        submission.feedback = `AUTO-GRADE ERROR: ${err.message}. Manual Review Required.`;
        await submission.save();
        return { success: false, error: err.message };
    }
}