import { useState, useEffect, useRef } from 'react'
import { getAuth, onAuthStateChanged } from 'firebase/auth'
import {
  getStorage,
  ref,
  uploadBytesResumable,
  getDownloadURL,
} from 'firebase/storage'
import { addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase.config'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import { v4 as uuidv4 } from 'uuid'
import Spinner from '../components/Spinner'


function CreateService() {
    const [ geolocationEnabled, setGeolocationEnabled ] = useState(true)
    const [ loading, setLoading ] = useState(false)
    const [ formData, setFormData ] = useState({
      name: "",
      email: "",
      category: "mental-performance",
      quote: "",
      inPersonCoaching: false,
      onlineCoaching: false,
      hourlyRate: 0,
      subscription: false,
      subscriptionPrice: 0,
      minCommit: 1,
      yearly: false,
      yearlyPrice: 0,
      reviews: [],
      avgRating: 3.5,
      businessLocation: "",
		  latitude: 0,
		  longitude: 0,
      images: {},
    })

    const {
      name,
      email,
      category,
      quote,
      inPersonCoaching,
      onlineCoaching,  
      hourlyRate,    
      subscription,
      subscriptionPrice,
      minCommit,
      yearly,
      yearlyPrice,
      reviews,
      avgRating,      
      businessLocation,
      latitude,
      longitude,
      images,
    } = formData

    const auth = getAuth()
    const navigate = useNavigate()
    const isMounted = useRef(true)

    useEffect(() => {
        if(isMounted) {
            onAuthStateChanged(auth, (user) => {
                if(user) {
                    setFormData({...formData, userRef: user.uid})
                } else {
                    navigate('/sign-in')
                }
            })
        }

        return () => {
            isMounted.current = false
        }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isMounted])

    const onSubmit = async (e) => {
        e.preventDefault()

        setLoading(true)

        // Must enter name and email 
        if (!name && !email) {
          setLoading(false)
          toast.error('Please enter your name and email')
          return
        }

        // Make sure yearly price is more than subscription price
        if (yearlyPrice >= (subscriptionPrice*12)) {
          setLoading(false)
          toast.error('Check that yearly price is greater than subscription price per year')
          return
        }

        // Must select inPerson or Online Coaching
        if (!inPersonCoaching && !onlineCoaching) {
          setLoading(false)
          toast.error('Must select either Online or In Person Coaching')
          return
        }

        if (images.length > 1) {
          setLoading(false)
          toast.error('Select only 1 image')
          return
        }

        let geolocation = {}
        let location

        if (geolocationEnabled) {
          const response = await fetch(
          `https://maps.googleapis.com/maps/api/geocode/json?address=${businessLocation}&key=${process.env.REACT_APP_GEOCODE_API_KEY}`
        )

        const data = await response.json()

        geolocation.lat = data.results[0]?.geometry.location.lat ?? 0
        geolocation.lng = data.results[0]?.geometry.location.lng ?? 0

        location =
          data.status === 'ZERO_RESULTS'
            ? undefined
            : data.results[0]?.formatted_address

      } else {
        geolocation.lat = latitude
        geolocation.lng = longitude
      }

      // Store image in firebase
      const storeImage = async (image) => {
        return new Promise((resolve, reject) => {
          const storage = getStorage()
          const fileName = `${auth.currentUser.uid}-${image.name}-${uuidv4()}`

          const storageRef = ref(storage, 'images/' + fileName)

          const uploadTask = uploadBytesResumable(storageRef, image)

          uploadTask.on(
            'state_changed',
            (snapshot) => {
              const progress =
                (snapshot.bytesTransferred / snapshot.totalBytes) * 100
              console.log('Upload is ' + progress + '% done')
              switch (snapshot.state) {
                case 'paused':
                  console.log('Upload is paused')
                  break
                case 'running':
                  console.log('Upload is running')
                  break
                default:
                  break
              }
            },
            (error) => {
              reject(error)
            },
            () => {
              // Handle successful uploads on complete
              // For instance, get the download URL: https://firebasestorage.googleapis.com/...
              getDownloadURL(uploadTask.snapshot.ref).then((downloadURL) => {
                resolve(downloadURL)
              })
            }
          )
        })
      }

      // This is storing all downloadUrls into imgUrls
      const imgUrls = await Promise.all(
        [...images].map((image) => storeImage(image))
      ).catch(() => {
        setLoading(false)
        toast.error('Images not uploaded')
        return
      })

      const formDataCopy = {
      ...formData,
      imgUrls,
      geolocation,
      timestamp: serverTimestamp(),
      }

      formDataCopy.location = businessLocation
      delete formDataCopy.images
      delete formDataCopy.businessLocation
      !formDataCopy.location && delete formDataCopy.location
      !formDataCopy.yearly && delete formDataCopy.yearlyPrice
      !formDataCopy.subscription && delete formDataCopy.subscriptionPrice

      const docRef = await addDoc(collection(db, 'coachingServices'), formDataCopy)
      setLoading(false)
      toast.success('Listing saved')
      navigate(`/category/${formDataCopy.category}/${docRef.id}`)

      // setLoading(false)
    }

    const onMutate = (e) => {
    let boolean = null

    if (e.target.value === 'true') {
      boolean = true
    }
    if (e.target.value === 'false') {
      boolean = false
    }

    // Files
    if (e.target.files) {
      setFormData((prevState) => ({
        ...prevState,
        images: e.target.files,
      }))
    }

    // Text/Booleans/Numbers
    if (!e.target.files) {
      setFormData((prevState) => ({
        ...prevState,
        [e.target.id]: boolean ?? e.target.value,
      }))
    }

  }

  if(loading) {
        return <Spinner />
    }


  return (
    <div className='profile'>
      <header>
        <p className='createServiceHeader'>Create a Service</p>
      </header>

      <main>
        <form onSubmit={onSubmit}>
          <label className='formLabel'>Category</label>
          <div className='formButtons categoryButtons'>
            <button
              type='button'
              className={ category === 'mental-performance' ? 'formButtonActive' : 'formButton'}
              id='category'
              value='mental-performance'
              onClick={onMutate}
            >
              Mental Performance
            </button>
            <button
              type='button'
              className={ category === 'nutrition' ? 'formButtonActive' : 'formButton'}
              id='category'
              value='nutrition'
              onClick={onMutate}
            >
              Nutrition
            </button>
            <button
              type='button'
              className={ category === 'life-performance' ? 'formButtonActive' : 'formButton'}
              id='category'
              value='life-performance'
              onClick={onMutate}
            >
              Life Performance
            </button>
          </div>

        {/* make this autofill */}
          <label className='formLabel'>Name</label>
          <input
            className='formInputName'
            type='text'
            id='name'
            value={name}
            onChange={onMutate}
            maxLength='32'
            minLength='5'
            required={name}
          />

          <label className='formLabel'>Email</label>
          <input
            className='formInputEmail'
            type='text'
            id='email'
            value={email}
            onChange={onMutate}
            maxLength='50'
            minLength='5'
            required={email}
          />

          <label className='formLabel'>Quote</label>
          <input
            className='formInputQuote'
            type='text'
            id='quote'
            value={quote}
            onChange={onMutate}
            maxLength='125'
            minLength='5'
          />

          <label className='formLabel'>Online Coaching</label>
          <div className='formButtons'>
            <button
              className={onlineCoaching ? 'formButtonActive' : 'formButton'}
              type='button'
              id='onlineCoaching'
              value={true}
              onClick={onMutate}
            >
              Yes
            </button>
            <button
              className={
                !onlineCoaching && onlineCoaching !== null
                  ? 'formButtonActive'
                  : 'formButton'
              }
              type='button'
              id='onlineCoaching'
              value={false}
              onClick={onMutate}
            >
              No
            </button>
          </div>

          <label className='formLabel'>In-Person Coaching</label>
          <div className='formButtons'>
            <button
              className={inPersonCoaching ? 'formButtonActive' : 'formButton'}
              type='button'
              id='inPersonCoaching'
              value={true}
              onClick={onMutate}
            >
              Yes
            </button>
            <button
              className={
                !inPersonCoaching && inPersonCoaching !== null ? 'formButtonActive' : 'formButton'
              }
              type='button'
              id='inPersonCoaching'
              value={false}
              onClick={onMutate}
            >
              No
            </button>
          </div>

          {/* make this minimum commitment area */}

          {inPersonCoaching && 
            (<><label className='formLabel'>Business Location</label>
              <textarea
                className='formInputAddress'
                type='text'
                id='businessLocation'
                value={businessLocation}
                onChange={onMutate}
              />
            </>
          )}

          {!geolocationEnabled && (
            <div className='formLatLng flex'>
              <div>
                <label className='formLabel'>Latitude</label>
                <input
                  className='formInputSmall'
                  type='number'
                  id='latitude'
                  value={latitude}
                  onChange={onMutate}
                  required
                />
              </div>
              <div>
                <label className='formLabel'>Longitude</label>
                <input
                  className='formInputSmall'
                  type='number'
                  id='longitude'
                  value={longitude}
                  onChange={onMutate}
                  required
                />
              </div>
            </div>
          )}

          <label className='formLabel'>Hourly Rate</label>
          <input
            className='formInputSmall'
            type='number'
            id='hourlyRate'
            value={hourlyRate}
            onChange={onMutate}
            min='10'
            max='10000'
            required={hourlyRate}
          />

          <label className='formLabel'>Yearly Payments Available</label>
          <div className='formButtons'>
            <button
              className={yearly ? 'formButtonActive' : 'formButton'}
              type='button'
              id='yearly'
              value={true}
              onClick={onMutate}
            >
              Yes
            </button>
            <button
              className={
                !yearly && yearly !== null ? 'formButtonActive' : 'formButton'
              }
              type='button'
              id='yearly'
              value={false}
              onClick={onMutate}
            >
              No
            </button>
          </div>

          {yearly && (
            <>
              <label className='formLabel'>Cost / Year</label>
              <input
                className='formInputSmall'
                type='number'
                id='yearlyPrice'
                value={yearlyPrice}
                onChange={onMutate}
                min='10'
                max='100000'
                required={yearly}
              />
            </>
          )}

          <label className='formLabel'>Subscriptions Available</label>
          <div className='formButtons'>
            <button
              className={subscription ? 'formButtonActive' : 'formButton'}
              type='button'
              id='subscription'
              value={true}
              onClick={onMutate}
            >
              Yes
            </button>
            <button
              className={
                !subscription && subscription !== null ? 'formButtonActive' : 'formButton'
              }
              type='button'
              id='subscription'
              value={false}
              onClick={onMutate}
            >
              No
            </button>
          </div>

          {subscription && (
            <>
              <label className='formLabel'>Cost / Month</label>
              <input
                className='formInputSmall'
                type='number'
                id='subscriptionPrice'
                value={subscriptionPrice}
                onChange={onMutate}
                min='10'
                max='100000'
                required={subscription}
              />
            </>
          )}

          {/* Min Commitment */}
          {/* <div className='formPriceDiv'>
            <input
              className='formInputSmall'
              type='number'
              id='subscriptionPrice'
              value={subscriptionPrice}
              onChange={onMutate}
              min='10'
              max='10000'
              required
            />
            </div>
            {subscription === true && <p className='formPriceText'>$ / Month</p>} */}

          <label className='formLabel'>Profile Image</label>
          <p className='imagesInfo'>
            We suggest using a professional headshot.
          </p>
          <input
            className='formInputFile'
            type='file'
            id='images'
            onChange={onMutate}
            max='1'
            accept='.jpg,.png,.jpeg'
            required
          />
          <button type='submit' className='createServiceButton'>
            Create Service
          </button>
        </form>
      </main>
    </div>
  )
}

export default CreateService