const fs = require('fs').promises;
const { exec } = require('child_process');
const path = require('path');
const { promisify } = require('util');
const execAsync = promisify(exec);

// Generate FASTA file
const generateFastaFile = (sequences, outputPath) => {
  const fastaContent = sequences.map(seq => 
    `>${seq.id} [organism=${seq.organism}] [moltype=mRNA] ${seq.cloneName}\n${seq.sequence}`
  ).join('\n\n');
  
  return fs.writeFile(outputPath, fastaContent);
};

// Generate feature table (.tbl file)
const generateFeatureTable = (sequences, outputPath) => {
  // Feature table format is tab-delimited
  const tableContent = sequences.map(seq => {
    const lines = [
      `>Feature ${seq.id}`,
      `1\t${seq.sequence.length}\tsource`,
      `\t\t\torganism\t${seq.organism}`,
      `\t\t\tmol_type\tmRNA`
    ];
    
    // Add additional source qualifiers if provided
    if (seq.isolationSource) {
      lines.push(`\t\t\tisolation_source\t${seq.isolationSource}`);
    }
    if (seq.country) {
      lines.push(`\t\t\tcountry\t${seq.country}`);
    }
    if (seq.collectionDate) {
      lines.push(`\t\t\tcollection_date\t${seq.collectionDate}`);
    }
    if (seq.cloneLibrary) {
      lines.push(`\t\t\tclone_lib\t${seq.cloneLibrary}`);
    }
    if (seq.clone) {
      lines.push(`\t\t\tclone\t${seq.clone}`);
    }
    
    return lines.join('\n');
  }).join('\n\n');
  
  return fs.writeFile(outputPath, tableContent);
};

// Generate submission template (.sbt file)
const generateSubmissionTemplate = (submitterInfo, outputPath) => {
  // Template file is a structured text format
  const templateContent = `Submit-block ::= {
  contact {
    contact {
      name name {
        last "${submitterInfo.lastName}",
        first "${submitterInfo.firstName}",
        initials "${submitterInfo.initials || ''}"
      },
      affil std {
        affil "${submitterInfo.institution}",
        city "${submitterInfo.city || ''}",
        sub "${submitterInfo.state || ''}",
        country "${submitterInfo.country || 'USA'}",
        postal-code "${submitterInfo.postalCode || ''}",
        email "${submitterInfo.email}"
      }
    }
  },
  cit {
    authors {
      names std {
        {
          name name {
            last "${submitterInfo.lastName}",
            first "${submitterInfo.firstName}",
            initials "${submitterInfo.initials || ''}"
          }
        }
      },
      affil std {
        affil "${submitterInfo.institution}",
        city "${submitterInfo.city || ''}",
        sub "${submitterInfo.state || ''}",
        country "${submitterInfo.country || 'USA'}",
        postal-code "${submitterInfo.postalCode || ''}"
      }
    }
  },
  subtype new
}`;
  
  return fs.writeFile(outputPath, templateContent);
};

// Run table2asn command (updated from tbl2asn)
const runTable2asn = async (workDir, fastaFile, templateFile) => {
  // table2asn uses slightly different flags
  const command = `table2asn -indir ${workDir} -t ${templateFile} -V vb -a s -outdir ${workDir}`;
  
  try {
    const { stdout, stderr } = await execAsync(command, { 
      cwd: workDir,
      maxBuffer: 1024 * 1024 * 10 // 10MB buffer for large outputs
    });
    console.log('table2asn output:', stdout);
    if (stderr) console.warn('table2asn warnings:', stderr);
    return { success: true, stdout, stderr };
  } catch (error) {
    console.error('table2asn error:', error);
    return { success: false, error: error.message, stderr: error.stderr };
  }
};

// Parse validation report
const parseValidationReport = async (reportPath) => {
  try {
    const content = await fs.readFile(reportPath, 'utf8');
    const errors = [];
    const warnings = [];
    
    // Parse the discrepancy report
    const lines = content.split('\n');
    lines.forEach(line => {
      if (line.includes('ERROR')) {
        errors.push(line.trim());
      } else if (line.includes('WARNING')) {
        warnings.push(line.trim());
      }
    });
    
    return { errors, warnings };
  } catch (error) {
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
    
    // Use the existing template file instead of generating one
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
    
    // Parse validation report - table2asn creates .val files
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
    
    // Read the .sqn file for storage or submission
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



module.exports = {
  processNCBISubmission,
  cleanupWorkDir
};