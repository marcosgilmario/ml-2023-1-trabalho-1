const xlsx = require("xlsx");
const fs = require("fs");

const workbook = xlsx.readFile("dataset.xlsx");
const worksheet = workbook.Sheets[workbook.SheetNames[0]];
const data = xlsx.utils.sheet_to_json(worksheet);

//console.log(data);

let df = data.map((obj) => {
  const newObj = {};
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      newObj[key] = obj[key];
    }
  }
  return newObj;
});

df = df.map((obj) => {
  delete obj["Patient ID"];
  return obj;
});

function fillColumn(columnName) {
  const freq = df.reduce((acc, obj) => {
    acc[obj[columnName]] = (acc[obj[columnName]] || 0) + 1;
    return acc;
  }, {});
  const mostFreqVal = Object.keys(freq).reduce((a, b) =>
    freq[a] > freq[b] ? a : b
  );
  df.forEach((obj) => {
    if (!obj[columnName]) {
      obj[columnName] = mostFreqVal;
    }
  });
}

for (let columnName of Object.keys(df[0])) {
  const countNaN = df.reduce((acc, obj) => {
    if (isNaN(obj[columnName])) {
      acc++;
    }
    return acc;
  }, 0);
  if (countNaN >= 5644 * 0.8) {
    console.log(`Columna eliminada por armazenar outlier: ${columnName}`);
    df.forEach((obj) => {
      delete obj[columnName];
    });
  } else {
    fillColumn(columnName);
  }
}

for (let columnName of Object.keys(df[0])) {
  const categories = df.reduce((acc, obj) => {
    acc[obj[columnName]] = true;
    return acc;
  }, {});
  let code = 0;
  const categoriesMap = {};
  for (const key in categories) {
    if (categories.hasOwnProperty(key)) {
      categoriesMap[key] = code;
      code++;
    }
  }
  df.forEach((obj) => {
    obj[columnName] = categoriesMap[obj[columnName]];
  });
  console.log(df.map((obj) => obj[columnName]));
}

function findOutliersIQR(columnName) {
  const columnData = df.map((obj) => obj[columnName]);
  const q = getQuantiles(columnData);
  const q1 = q[0];
  const q3 = q[2];
  const IQR = q3 - q1;
  let outliers = [];
  df.forEach((obj) => {
    if (obj[columnName] < q1 - 1.5 * IQR || obj[columnName] > q3 + 1.5 * IQR) {
      outliers.push(obj);
    }
  });
  return outliers;
}


function removeOutliersIQR(columnName) {
  const columnData = df.map((obj) => obj[columnName]);
  const q = getQuantiles(columnData);
  const q1 = q[0];
  const q3 = q[2];
  const IQR = q3 - q1;
  const newDf = [];
  const removedValues = [];
  df.forEach((obj) => {
    if (obj[columnName] >= q1 - 1.5 * IQR && obj[columnName] <= q3 + 1.5 * IQR) {
      newDf.push(obj);
    } else {
      removedValues.push(obj[columnName]);
    }
  });
  df = newDf;
  return removedValues;
}

for (let columnName of Object.keys(df[0])) {
  const removedValues = removeOutliersIQR(columnName);
  if (removedValues.length > 0) {
    console.log(`Coluna ${columnName}: ${removedValues.length} outliers removidos: ${removedValues}`);
  }
}

function getQuantiles(columnData) {
  columnData.sort((a, b) => a - b);
  const median = getMedian(columnData);
  const q1 = getMedian(columnData.slice(0, columnData.length / 2));
  const q3 = getMedian(
    columnData.slice(
      columnData.length / 2 + (columnData.length % 2 === 0 ? 0 : 1)
    )
  );
  return [q1, median, q3];
}

function getMedian(data) {
  const middle = Math.floor(data.length / 2);
  if (data.length % 2 === 0) {
    return (data[middle - 1] + data[middle]) / 2;
  } else {
    return data[middle];
  }
}

for (let columnName of Object.keys(df[0])) {
  const outliers = findOutliersIQR(columnName);
  for (const obj of outliers) {
    console.log(obj);
  }
}


function generateOutliersReport(df) {
  const outliersReport = {};
  const withoutOutliers = {};

  for (let columnName of Object.keys(df[0])) {
    const outliers = findOutliersIQR(columnName);
    if (outliers.length > 0) {
      outliersReport[columnName] = outliers;
      df = df.filter((obj) => !outliers.includes(obj));
    }
    withoutOutliers[columnName] = df.map((obj) => obj[columnName]);
  }

  const outliersReportStr = JSON.stringify(outliersReport, null, 2);
  const withoutOutliersStr = JSON.stringify(withoutOutliers, null, 2);

  fs.writeFile("outliers-report.txt", outliersReportStr, (err) => {
    if (err) throw err;
    console.log("Report de outliers salvo em outliers-report.txt");
  });

  fs.writeFile("without-outliers.txt", withoutOutliersStr, (err) => {
    if (err) throw err;
    console.log("Daddos sem outlier exportados para without-outliers.txt");
  });
}

generateOutliersReport(df);
