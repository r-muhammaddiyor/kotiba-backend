import mongoose from "mongoose";

const globalConnection = globalThis.__kotibaMongo ?? {
  promise: null,
  connection: null
};

globalThis.__kotibaMongo = globalConnection;

export const connectDb = async (mongoUri) => {
  if (globalConnection.connection && mongoose.connection.readyState === 1) {
    return globalConnection.connection;
  }

  if (globalConnection.promise) {
    return globalConnection.promise;
  }

  globalConnection.promise = mongoose
    .connect(mongoUri, {
      autoIndex: true
    })
    .then((mongooseInstance) => {
      globalConnection.connection = mongooseInstance.connection;
      return globalConnection.connection;
    })
    .catch((error) => {
      globalConnection.promise = null;
      throw error;
    });

  return globalConnection.promise;
};
