const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

let isMockDB = false;
const mockDataDir = path.join(__dirname, '../../data');

class MockQuery {
  constructor(data) {
    this.data = data;
  }

  sort(criteria) {
    if (!criteria) return this;
    const keys = Object.keys(criteria);
    if (keys.length > 0) {
      const key = keys[0];
      const order = criteria[key];
      this.data.sort((a, b) => {
        let valA = a[key];
        let valB = b[key];

        if (valA === undefined || valA === null) return 1;
        if (valB === undefined || valB === null) return -1;

        if (key === 'createdAt' || (typeof valA === 'string' && !isNaN(Date.parse(valA)))) {
          const timeA = new Date(valA).getTime();
          const timeB = new Date(valB).getTime();
          if (!isNaN(timeA) && !isNaN(timeB)) {
            valA = timeA;
            valB = timeB;
          }
        }

        if (valA < valB) return order === -1 ? 1 : -1;
        if (valA > valB) return order === -1 ? -1 : 1;
        return 0;
      });
    }
    return this;
  }

  limit(num) {
    if (typeof num === 'number') {
      this.data = this.data.slice(0, num);
    }
    return this;
  }

  then(onFulfilled, onRejected) {
    return Promise.resolve(this.data).then(onFulfilled, onRejected);
  }
}

// Simple Mongoose-like mock query helper
class MockModel {
  constructor(filename, defaultData = []) {
    this.filePath = path.join(mockDataDir, `${filename}.json`);
    if (!fs.existsSync(mockDataDir)) {
      fs.mkdirSync(mockDataDir, { recursive: true });
    }
    if (!fs.existsSync(this.filePath)) {
      fs.writeFileSync(this.filePath, JSON.stringify(defaultData, null, 2));
    }
  }

  read() {
    try {
      const content = fs.readFileSync(this.filePath, 'utf-8');
      return JSON.parse(content);
    } catch (e) {
      return [];
    }
  }

  write(data) {
    fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2));
  }

  find(query = {}) {
    const data = this.read();
    const filtered = data.filter(item => {
      for (let key in query) {
        if (item[key] !== query[key]) return false;
      }
      return true;
    });
    return new MockQuery(filtered);
  }

  async findOne(query = {}) {
    const data = this.read();
    return data.find(item => {
      for (let key in query) {
        if (item[key] !== query[key]) return false;
      }
      return true;
    }) || null;
  }

  async findById(id) {
    const data = this.read();
    return data.find(item => item._id === id || item.id === id) || null;
  }

  async findByIdAndUpdate(id, update, options = {}) {
    const data = this.read();
    const index = data.findIndex(item => item._id === id || item.id === id);
    if (index === -1) return null;
    
    let updatedItem = { ...data[index] };
    if (update.$set) {
      updatedItem = { ...updatedItem, ...update.$set };
    } else {
      updatedItem = { ...updatedItem, ...update };
    }
    
    data[index] = updatedItem;
    this.write(data);
    return updatedItem;
  }

  async create(doc) {
    const data = this.read();
    const newDoc = {
      _id: Math.random().toString(36).substr(2, 9),
      createdAt: new Date().toISOString(),
      ...doc
    };
    data.push(newDoc);
    this.write(data);
    return newDoc;
  }

  async insertMany(docs) {
    const data = this.read();
    const newDocs = docs.map(doc => ({
      _id: Math.random().toString(36).substr(2, 9),
      createdAt: new Date().toISOString(),
      ...doc
    }));
    data.push(...newDocs);
    this.write(data);
    return newDocs;
  }

  async updateOne(query = {}, update = {}) {
    const data = this.read();
    const item = data.find(item => {
      for (let key in query) {
        if (item[key] !== query[key]) return false;
      }
      return true;
    });
    if (!item) return { nModified: 0 };
    
    const index = data.indexOf(item);
    let updatedItem = { ...item };
    if (update.$set) {
      updatedItem = { ...updatedItem, ...update.$set };
    } else {
      updatedItem = { ...updatedItem, ...update };
    }
    data[index] = updatedItem;
    this.write(data);
    return { nModified: 1 };
  }

  async deleteMany(query = {}) {
    const data = this.read();
    const filtered = data.filter(item => {
      for (let key in query) {
        if (item[key] === query[key]) return false;
      }
      return true;
    });
    this.write(filtered);
    return { deletedCount: data.length - filtered.length };
  }
}

const mockModels = {};

function getMockModel(name, defaultData = []) {
  if (!mockModels[name]) {
    mockModels[name] = new MockModel(name.toLowerCase(), defaultData);
  }
  return mockModels[name];
}

const connectDB = async () => {
  const mongoURI = process.env.MONGODB_URI;
  if (!mongoURI) {
    console.log('⚠️ No MONGODB_URI environment variable detected. Falling back to local file-based mock database.');
    isMockDB = true;
    return;
  }

  try {
    await mongoose.connect(mongoURI);
    console.log('🚀 MongoDB Atlas connected successfully!');
  } catch (error) {
    console.error(`❌ MongoDB connection error: ${error.message}`);
    console.log('⚠️ Falling back to local file-based mock database.');
    isMockDB = true;
  }
};

module.exports = {
  connectDB,
  isMock: () => isMockDB,
  getMockModel,
};
