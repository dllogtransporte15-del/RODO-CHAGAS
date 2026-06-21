import fs from 'fs';
import path from 'path';

const filesToProcess = [
  'components/DriverFormModal.tsx',
  'components/OwnerFormModal.tsx',
  'components/UserFormModal.tsx',
  'components/VehicleFormModal.tsx',
  'components/EmbarcadorFormModal.tsx',
  'components/ArmadorFormModal.tsx',
  'components/ClientFormModal.tsx',
  'components/LoadFormModal.tsx',
  'components/TicketModal.tsx',
  'components/ShipmentDetailsModal.tsx',
  'pages/LayoverCalculatorPage.tsx',
  'pages/FreightQuotePage.tsx',
  'components/FreightQuote.tsx',
  'components/StayCalculator.tsx'
];

const basePath = 'c:/Users/davis/Documents/RODO-CHAGAS';

for (const relPath of filesToProcess) {
  const filePath = path.join(basePath, relPath);
  if (!fs.existsSync(filePath)) {
    console.log(`File not found: ${filePath}`);
    continue;
  }
  
  let content = fs.readFileSync(filePath, 'utf8');
  let originalContent = content;

  // Ensure import
  if (!content.includes('autoFormatInput')) {
    const importPath = relPath.startsWith('pages/') ? '../utils/formatters' : '../utils/formatters';
    
    // Add import after the last import statement
    const lastImportIndex = content.lastIndexOf('import ');
    const endOfLastImport = content.indexOf('\n', lastImportIndex);
    if (lastImportIndex !== -1 && endOfLastImport !== -1) {
      content = content.slice(0, endOfLastImport + 1) + `import { autoFormatInput } from '${importPath}';\n` + content.slice(endOfLastImport + 1);
    }
  }

  // Find handleChange or handleInputChange
  const regexes = [
    /const (handleChange|handleInputChange) = \(.*?\) => \{\s*const \{ name, value/g,
    /const (handleChange|handleInputChange) = \(.*?\) => \{\s*const \{ name, value, type \} = e\.target;/g,
    /const (handleChange|handleInputChange) = \(.*?\) => \{\s*const \{ name, value, type, checked \} = e\.target;/g
  ];

  let modified = false;

  content = content.replace(/const (handleChange|handleInputChange) = \((.*?)\) => \{\s*const \{ (.*?)value(.*?) \} = (e|event)\.target;/g, (match, funcName, args, pre, post, ev) => {
    modified = true;
    return `const ${funcName} = (${args}) => {\n    const { ${pre}value${post} } = ${ev}.target;\n    const formattedValue = autoFormatInput(name, value);`;
  });
  
  // replace the usage of `value` inside the setter with `formattedValue`, but only in the same function scope?
  // a safer regex:
  if (modified) {
     // replace `[name]: type === 'checkbox' ? checked : value`
     content = content.replace(/\[name\]:\s*type === 'checkbox' \? checked : value/g, "[name]: type === 'checkbox' ? checked : formattedValue");
     // replace `[name]: value`
     content = content.replace(/\[name\]:\s*value/g, "[name]: formattedValue");
     // replace `[e.target.name]: e.target.value` if any
     content = content.replace(/\[e\.target\.name\]:\s*e\.target\.value/g, "[name]: formattedValue");
  }

  // there might be direct e.target.value assignments like onChange={e => setXYZ({...xyz, [name]: autoFormatInput(name, e.target.value)})}
  // let's check for inline onChange
  
  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated ${relPath}`);
  } else {
    console.log(`No changes made to ${relPath}`);
  }
}
