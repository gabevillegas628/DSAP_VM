const fs = require('fs').promises;
const { exec } = require('child_process');
const path = require('path');
const { promisify } = require('util');
const execAsync = promisify(exec);

// Helper function for NCBI date format
const formatNCBIDate = (dateString) => {
    if (!dateString) return null;

    const date = new Date(dateString);
    if (isNaN(date.getTime())) return null;

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    return `${date.getDate()}-${months[date.getMonth()]}-${date.getFullYear()}`;
};

// Helper for country format
const formatNCBICountry = (country) => {
    if (!country) return null;
    return country.trim();
};

// Helper to escape special characters
const escapeValue = (value) => {
    if (!value) return value;
    return value.replace(/[\t\n\r]/g, ' ').trim();
};

// Generate FASTA file
const generateFastaFile = async (sequences, outputPath) => {
    const fastaContent = sequences.map(seq =>
        `>${seq.id} [organism=${escapeValue(seq.organism)}] [moltype=mRNA] ${escapeValue(seq.cloneName)}\n${seq.sequence}`
    ).join('\n\n');

    await fs.writeFile(outputPath, fastaContent, 'utf8');
};

// Generate feature table (.tbl file)
const generateFeatureTable = async (sequences, outputPath) => {
    const tableContent = sequences.map(seq => {
        const lines = [
            `>Feature ${seq.id}`,
            `1\t${seq.sequence.length}\tsource`,
            `\t\t\torganism\t${escapeValue(seq.organism)}`
        ];

        // Add additional source qualifiers if provided
        if (seq.isolationSource) {
            lines.push(`\t\t\tisolation_source\t${escapeValue(seq.isolationSource)}`);
        }
        if (seq.country) {
            const formattedCountry = formatNCBICountry(seq.country);
            if (formattedCountry) {
                lines.push(`\t\t\tcountry\t${formattedCountry}`);
            }
        }
        if (seq.collectionDate) {
            const formattedDate = formatNCBIDate(seq.collectionDate);
            if (formattedDate) {
                lines.push(`\t\t\tcollection_date\t${formattedDate}`);
            }
        }
        if (seq.cloneLibrary) {
            lines.push(`\t\t\tclone_lib\t${escapeValue(seq.cloneLibrary)}`);
        }
        if (seq.clone) {
            lines.push(`\t\t\tclone\t${escapeValue(seq.clone)}`);
        }

        return lines.join('\n');
    }).join('\n\n');

    await fs.writeFile(outputPath, tableContent, 'utf8');
};

// Run table2asn command
const runTable2asn = async (workDir, fastaFile, templateFile) => {
    const discrepFile = path.join(workDir, 'discrep.txt');
    const command = `table2asn -indir ${workDir} -t ${templateFile} -V vb -a rs -outdir ${workDir} -z ${discrepFile}`;

    try {
        const { stdout, stderr } = await execAsync(command, {
            cwd: workDir,
            maxBuffer: 1024 * 1024 * 10,
            timeout: 60000
        });

        console.log('table2asn output:', stdout);
        if (stderr) console.warn('table2asn stderr:', stderr);

        // Check if stderr contains actual errors (not just warnings)
        if (stderr && stderr.toLowerCase().includes('error:')) {
            return { success: false, error: 'table2asn reported errors', stderr };
        }

        return { success: true, stdout, stderr };
    } catch (error) {
        console.error('table2asn error:', error);
        return {
            success: false,
            error: error.message,
            stderr: error.stderr || ''
        };
    }
};

// Parse validation report
const parseValidationReport = async (reportPath) => {
    try {
        const exists = await fs.access(reportPath).then(() => true).catch(() => false);
        if (!exists) {
            return { errors: [], warnings: [] };
        }

        const content = await fs.readFile(reportPath, 'utf8');
        const errors = [];
        const warnings = [];

        const lines = content.split('\n');
        lines.forEach(line => {
            const lowerLine = line.toLowerCase();
            if (lowerLine.includes('error')) {
                errors.push(line.trim());
            } else if (lowerLine.includes('warning')) {
                warnings.push(line.trim());
            }
        });

        return { errors, warnings };
    } catch (error) {
        console.error('Error parsing validation report:', error);
        return { errors: [], warnings: [] };
    }
};

// Main submission function
const processNCBISubmission = async (sequences, submitterInfo) => {
    const workDir = path.join(__dirname, 'temp', `ncbi_${Date.now()}`);
    await fs.mkdir(workDir, { recursive: true });

    try {
        const fastaFile = path.join(workDir, 'sequences.fsa');
        const featureFile = path.join(workDir, 'sequences.tbl');
        const templateFile = path.join(__dirname, 'template.sbt');

        // Verify template exists
        const templateExists = await fs.access(templateFile).then(() => true).catch(() => false);
        if (!templateExists) {
            throw new Error('Template file (template.sbt) not found in server directory');
        }

        // Generate input files
        await generateFastaFile(sequences, fastaFile);
        await generateFeatureTable(sequences, featureFile);

        // Run table2asn
        const result = await runTable2asn(workDir, fastaFile, templateFile);

        if (!result.success) {
            return {
                success: false,
                error: 'table2asn execution failed',
                details: result.error,
                stderr: result.stderr
            };
        }

        // Parse validation report
        const valFile = path.join(workDir, 'sequences.val');
        const validation = await parseValidationReport(valFile);

        // Check for the output .sqn file
        const sqnFile = path.join(workDir, 'sequences.sqn');
        const sqnExists = await fs.access(sqnFile).then(() => true).catch(() => false);

        if (!sqnExists) {
            return {
                success: false,
                error: 'Submission file (.sqn) was not generated',
                validation,
                details: result.stderr
            };
        }

        // Read the .sqn file for storage
        const sqnContent = await fs.readFile(sqnFile);

        return {
            success: true,
            sqnFile: sqnContent,
            sqnPath: sqnFile,
            validation,
            workDir
        };

    } catch (error) {
        console.error('NCBI submission processing error:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

// Cleanup temporary files
const cleanupWorkDir = async (workDir) => {
    try {
        await fs.rm(workDir, { recursive: true, force: true });
    } catch (error) {
        console.error('Cleanup error:', error);
    }
};

module.exports = {
    processNCBISubmission,
    cleanupWorkDir
};