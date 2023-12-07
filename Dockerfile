FROM urielch/opencv-nodejs:6.2.4
WORKDIR /usr/src/app
COPY package*.json tsconfig.* ./
# should be quick after a ci
RUN npm remove @u4/opencv4nodejs
# will create the package-lock.json
RUN npm install --force
# create sym links, longest step
RUN npm link @u4/opencv4nodejs
COPY ./ ./
RUN npm run build-ts

# debug
# CMD ["/bin/bash"]

CMD ["node", "./"]
